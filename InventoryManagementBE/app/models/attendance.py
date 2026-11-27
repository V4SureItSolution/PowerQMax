from app import db
from datetime import datetime

class Attendance(db.Model):
    __tablename__ = 'attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    check_in_time = db.Column(db.DateTime, nullable=True)
    check_out_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='present')  # present, absent, late, half-day
    total_hours = db.Column(db.Float, default=0.0)  # hours worked
    overtime = db.Column(db.Float, default=0.0)  # overtime hours
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    employee = db.relationship('Employee', backref='attendances')
    
    def to_dict(self):
        emp_name = None
        emp_code = None
        if self.employee:
            emp_name = getattr(self.employee, 'full_name', getattr(self.employee, 'name', None))
            emp_code = getattr(self.employee, 'employee_id', None)
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': emp_name,
            'employee_code': emp_code,
            'date': self.date.isoformat() if self.date else None,
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'check_out_time': self.check_out_time.isoformat() if self.check_out_time else None,
            'status': self.status,
            'total_hours': self.total_hours or 0.0,
            'overtime': self.overtime or 0.0,
            'notes': self.notes or ''
        }


def ensure_attendance_schema(engine=None):
    """Ensure attendance table exists and has necessary columns."""
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        if 'attendance' not in tables:
            Attendance.__table__.create(target_engine, checkfirst=True)
            print("Created attendance table")
    except Exception as e:
        print(f"Error in ensure_attendance_schema: {e}")
