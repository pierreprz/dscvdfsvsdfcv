# 🤖 Jarvis PE Assistant

Votre assistant IA personnel style **Jarvis / Iron Man**, conçu spécialement pour un professeur d'EPS.

## Fonctionnalités

- 🔒 **Déverrouillage vocal** : dites votre code pour activer Jarvis
- 🎙️ **Reconnaissance vocale** : parlez à Jarvis, il vous répond à voix haute
- 🤖 **IA conversationnelle** : propulsée par Claude (Anthropic)
- 👨‍🎓 **Gestion des élèves** : ajout, notes, absences, commentaires
- 📊 **Statistiques** : moyennes, évolution, élèves en difficulté
- 🏃 **Contexte EPS** : handball, natation, athlétisme, gym...

## Installation

### 1. Prérequis
```
Python 3.10+
pip
```

### 2. Installer les dépendances
```bash
cd jarvis-pe
pip install -r requirements.txt
```

### 3. Configurer l'environnement
```bash
cp .env.example .env
```

Ouvrez `.env` et configurez :
```
ANTHROPIC_API_KEY=sk-ant-votre-clé-ici
VOICE_UNLOCK_CODE=jarvis activation
```

> 🔑 Obtenez votre clé API sur https://console.anthropic.com

### 4. Lancer le serveur
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

### 5. Ouvrir l'application
Ouvrez votre navigateur sur : **http://localhost:8000**

## Utilisation

### Déverrouillage
Dites votre **code vocal** (défini dans `.env`) pour déverrouiller Jarvis.
Par défaut : *"Jarvis activation"*

### Parler à Jarvis
- Cliquez sur le **microphone** 🎤 ou appuyez sur **Espace**
- Parlez naturellement en français
- Jarvis vous répond à voix haute et à l'écran

### Exemples de commandes
- *"Comment va mon élève Thomas Dupont ?"*
- *"Quelles sont les moyennes de la 3ème B ?"*
- *"Qui a le plus d'absences ?"*
- *"Génère un commentaire de bulletin pour Marie Martin"*
- *"Comment tu vas Jarvis ?"*

### Gestion des élèves
Cliquez sur l'onglet **Élèves** pour :
- Ajouter un élève
- Saisir des notes par activité
- Enregistrer des absences
- Consulter les statistiques
