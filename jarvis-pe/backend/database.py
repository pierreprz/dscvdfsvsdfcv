from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os

DATABASE_URL = "sqlite:///./jarvis_pe.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    classe = Column(String, nullable=False)
    date_naissance = Column(String, nullable=True)
    notes = Column(Text, nullable=True)  # notes générales
    absences = relationship("Absence", back_populates="student", cascade="all, delete")
    grades = relationship("Grade", back_populates="student", cascade="all, delete")


class Absence(Base):
    __tablename__ = "absences"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    date = Column(String, nullable=False)
    justifiee = Column(Boolean, default=False)
    commentaire = Column(Text, nullable=True)
    student = relationship("Student", back_populates="absences")


class Grade(Base):
    __tablename__ = "grades"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    date = Column(String, nullable=False)
    activite = Column(String, nullable=False)  # ex: "Natation", "Handball"
    note = Column(Float, nullable=False)
    note_max = Column(Float, default=20.0)
    commentaire = Column(Text, nullable=True)
    student = relationship("Student", back_populates="grades")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
