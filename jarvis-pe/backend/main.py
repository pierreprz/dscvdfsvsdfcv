import os
import json
import hashlib
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
import anthropic
from database import get_db, init_db, Student, Absence, Grade

load_dotenv()

app = FastAPI(title="Jarvis PE Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VOICE_CODE = os.getenv("VOICE_UNLOCK_CODE", "jarvis activation").lower().strip()
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")


@app.on_event("startup")
def startup():
    init_db()


# ── MODÈLES PYDANTIC ──────────────────────────────────────────────────────────

class VoiceCodeCheck(BaseModel):
    transcription: str

class ChatMessage(BaseModel):
    message: str
    history: Optional[List[dict]] = []

class StudentCreate(BaseModel):
    nom: str
    prenom: str
    classe: str
    date_naissance: Optional[str] = None
    notes: Optional[str] = None

class AbsenceCreate(BaseModel):
    student_id: int
    date: str
    justifiee: bool = False
    commentaire: Optional[str] = None

class GradeCreate(BaseModel):
    student_id: int
    date: str
    activite: str
    note: float
    note_max: float = 20.0
    commentaire: Optional[str] = None


# ── DÉVERROUILLAGE VOCAL ──────────────────────────────────────────────────────

@app.post("/api/unlock")
def check_voice_code(body: VoiceCodeCheck):
    """Vérifie si la transcription vocale correspond au code de déverrouillage."""
    spoken = body.transcription.lower().strip()
    if VOICE_CODE in spoken or spoken in VOICE_CODE:
        return {"success": True, "message": "Accès autorisé. Bonjour, je suis prêt."}
    return {"success": False, "message": "Code non reconnu."}


@app.get("/api/voice-code-hint")
def get_voice_code_hint():
    """Retourne le nombre de mots du code vocal (sans le révéler)."""
    word_count = len(VOICE_CODE.split())
    return {"word_count": word_count, "hint": f"Code de {word_count} mot(s)"}


# ── CHAT IA ───────────────────────────────────────────────────────────────────

@app.post("/api/chat")
def chat(body: ChatMessage, db: Session = Depends(get_db)):
    """Endpoint principal du chat Jarvis."""
    if not ANTHROPIC_KEY:
        raise HTTPException(status_code=500, detail="Clé API Anthropic manquante dans .env")

    # Récupère les données élèves pour le contexte
    students = db.query(Student).all()
    students_context = ""
    if students:
        students_context = "\n\nDonnées élèves disponibles:\n"
        for s in students:
            absences_count = len(s.absences)
            abs_justif = sum(1 for a in s.absences if a.justifiee)
            grades_info = ""
            if s.grades:
                avg = sum(g.note / g.note_max * 20 for g in s.grades) / len(s.grades)
                grades_info = f", Moyenne: {avg:.1f}/20 ({len(s.grades)} note(s))"
            students_context += f"- {s.prenom} {s.nom} ({s.classe}): {absences_count} absence(s) ({abs_justif} justifiée(s)){grades_info}\n"

    system_prompt = f"""Tu es Jarvis, l'assistant personnel de Pierre, professeur d'EPS.
Tu parles UNIQUEMENT en français. Tu es intelligent, efficace et légèrement sophistiqué comme Jarvis dans Iron Man.
Tu t'adresses à Pierre avec respect et professionnalisme, mais aussi avec une touche de chaleur.
Tu connais le contexte scolaire EPS : handball, natation, athlétisme, gymnastique, etc.

Tu peux :
- Répondre à toutes les questions
- Discuter de manière naturelle et demander comment va Pierre
- Analyser les performances des élèves et donner des statistiques
- Suggérer des pistes pédagogiques
- Identifier les élèves en difficulté (notes basses, absences fréquentes)
- Générer des commentaires pour les bulletins

Si Pierre te demande des infos sur un élève spécifique, utilise les données ci-dessous.{students_context}

Ton style : phrases courtes, précises, avec parfois une légère touche d'humour raffiné. 
Commence parfois tes réponses par "Bien sûr,", "Certainement,", "À votre service," etc."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    messages = []
    for h in (body.history or []):
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.message})

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    return {"response": response.content[0].text}


# ── ÉLÈVES ────────────────────────────────────────────────────────────────────

@app.get("/api/students")
def list_students(classe: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Student)
    if classe:
        q = q.filter(Student.classe == classe)
    students = q.all()
    result = []
    for s in students:
        abs_count = len(s.absences)
        abs_justif = sum(1 for a in s.absences if a.justifiee)
        grades = s.grades
        moyenne = None
        if grades:
            moyenne = round(sum(g.note / g.note_max * 20 for g in grades) / len(grades), 2)
        result.append({
            "id": s.id,
            "nom": s.nom,
            "prenom": s.prenom,
            "classe": s.classe,
            "date_naissance": s.date_naissance,
            "notes": s.notes,
            "absences_total": abs_count,
            "absences_justifiees": abs_justif,
            "absences_injustifiees": abs_count - abs_justif,
            "moyenne": moyenne,
            "nb_notes": len(grades),
        })
    return result


@app.get("/api/students/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    return {
        "id": s.id,
        "nom": s.nom,
        "prenom": s.prenom,
        "classe": s.classe,
        "date_naissance": s.date_naissance,
        "notes": s.notes,
        "absences": [{"id": a.id, "date": a.date, "justifiee": a.justifiee, "commentaire": a.commentaire} for a in s.absences],
        "grades": [{"id": g.id, "date": g.date, "activite": g.activite, "note": g.note, "note_max": g.note_max, "commentaire": g.commentaire} for g in s.grades],
    }


@app.post("/api/students")
def create_student(body: StudentCreate, db: Session = Depends(get_db)):
    s = Student(**body.dict())
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "message": f"Élève {s.prenom} {s.nom} ajouté avec succès."}


@app.put("/api/students/{student_id}")
def update_student(student_id: int, body: StudentCreate, db: Session = Depends(get_db)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    for k, v in body.dict().items():
        setattr(s, k, v)
    db.commit()
    return {"message": "Élève mis à jour."}


@app.delete("/api/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    db.delete(s)
    db.commit()
    return {"message": "Élève supprimé."}


# ── ABSENCES ─────────────────────────────────────────────────────────────────

@app.post("/api/absences")
def add_absence(body: AbsenceCreate, db: Session = Depends(get_db)):
    a = Absence(**body.dict())
    db.add(a)
    db.commit()
    return {"message": "Absence enregistrée."}


@app.delete("/api/absences/{absence_id}")
def delete_absence(absence_id: int, db: Session = Depends(get_db)):
    a = db.query(Absence).filter(Absence.id == absence_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Absence non trouvée")
    db.delete(a)
    db.commit()
    return {"message": "Absence supprimée."}


# ── NOTES ─────────────────────────────────────────────────────────────────────

@app.post("/api/grades")
def add_grade(body: GradeCreate, db: Session = Depends(get_db)):
    g = Grade(**body.dict())
    db.add(g)
    db.commit()
    return {"message": "Note enregistrée."}


@app.delete("/api/grades/{grade_id}")
def delete_grade(grade_id: int, db: Session = Depends(get_db)):
    g = db.query(Grade).filter(Grade.id == grade_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Note non trouvée")
    db.delete(g)
    db.commit()
    return {"message": "Note supprimée."}


# ── STATS ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    students = db.query(Student).all()
    classes = {}
    for s in students:
        c = s.classe
        if c not in classes:
            classes[c] = {"eleves": 0, "absences": 0, "notes": [], "en_difficulte": []}
        classes[c]["eleves"] += 1
        classes[c]["absences"] += len(s.absences)
        for g in s.grades:
            classes[c]["notes"].append(g.note / g.note_max * 20)
        if s.grades:
            avg = sum(g.note / g.note_max * 20 for g in s.grades) / len(s.grades)
            if avg < 10:
                classes[c]["en_difficulte"].append(f"{s.prenom} {s.nom}")

    result = []
    for c, data in classes.items():
        moy = round(sum(data["notes"]) / len(data["notes"]), 2) if data["notes"] else None
        result.append({
            "classe": c,
            "nb_eleves": data["eleves"],
            "total_absences": data["absences"],
            "moyenne_classe": moy,
            "eleves_en_difficulte": data["en_difficulte"],
        })
    return result


# ── FRONTEND ──────────────────────────────────────────────────────────────────
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
