from __future__ import annotations

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(8), default="SC")
    streak_days = db.Column(db.Integer, default=1)
    referral_code = db.Column(db.String(32), nullable=False, unique=True)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    enrollments = db.relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")
    comments = db.relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    payment_methods = db.relationship("PaymentMethod", back_populates="user", cascade="all, delete-orphan")


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(120), nullable=False, unique=True)
    title = db.Column(db.String(160), nullable=False)
    subtitle = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=False)
    level = db.Column(db.String(40), nullable=False)
    is_free = db.Column(db.Boolean, default=False)
    price = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=4.5)
    students = db.Column(db.Integer, default=0)
    locked = db.Column(db.Boolean, default=True)
    tags = db.Column(db.String(255), default="")

    sections = db.relationship("CourseSection", back_populates="course", cascade="all, delete-orphan")
    comments = db.relationship("Comment", back_populates="course", cascade="all, delete-orphan")
    enrollments = db.relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")


class CourseSection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    duration = db.Column(db.String(24), nullable=False)
    position = db.Column(db.Integer, nullable=False)

    course = db.relationship("Course", back_populates="sections")
    progress_items = db.relationship("Progress", back_populates="section", cascade="all, delete-orphan")


class Enrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    progress_percent = db.Column(db.Integer, default=0)
    is_completed = db.Column(db.Boolean, default=False)
    purchased = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="enrollments")
    course = db.relationship("Course", back_populates="enrollments")
    progress_items = db.relationship("Progress", back_populates="enrollment", cascade="all, delete-orphan")


class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(db.Integer, db.ForeignKey("enrollment.id"), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey("course_section.id"), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    enrollment = db.relationship("Enrollment", back_populates="progress_items")
    section = db.relationship("CourseSection", back_populates="progress_items")


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    stars = db.Column(db.Integer, default=5)

    user = db.relationship("User", back_populates="comments")
    course = db.relationship("Course", back_populates="comments")


class PaymentMethod(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    brand = db.Column(db.String(40), nullable=False)
    last4 = db.Column(db.String(4), nullable=False)

    user = db.relationship("User", back_populates="payment_methods")
