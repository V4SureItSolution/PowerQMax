from app import db
from datetime import datetime

class Salary(db.Model):
    __tablename__ = 'salaries'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    month = db.Column(db.String(20), nullable=False)   # e.g., 'January', 'February'
    year = db.Column(db.Integer, nullable=False)       # e.g., 2026
    
    # Earnings (in SGD $)
    basic_salary = db.Column(db.Float, default=0.0)
    allowances = db.Column(db.Float, default=0.0)
    overtime_pay = db.Column(db.Float, default=0.0)
    bonus = db.Column(db.Float, default=0.0)
    gross_salary = db.Column(db.Float, default=0.0)
    
    # Deductions (in SGD $)
    deductions = db.Column(db.Float, default=0.0)
    cpf_employee = db.Column(db.Float, default=0.0)    # Employee CPF contribution
    cpf_employer = db.Column(db.Float, default=0.0)    # Employer CPF contribution (info)
    net_salary = db.Column(db.Float, default=0.0)
    
    # Payout details
    payment_method = db.Column(db.String(50), default='Bank Transfer')  # Bank Transfer, PayNow, Cash, Cheque
    payment_status = db.Column(db.String(20), default='Pending')        # Pending, Paid, Processing
    payment_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    employee = db.relationship('Employee', backref=db.backref('salaries', lazy=True, cascade='all, delete-orphan'))
    
    def calculate_totals(self):
        """Calculate gross and net salaries."""
        basic = float(self.basic_salary or 0.0)
        allowance = float(self.allowances or 0.0)
        ot = float(self.overtime_pay or 0.0)
        bon = float(self.bonus or 0.0)
        ded = float(self.deductions or 0.0)
        cpf = float(self.cpf_employee or 0.0)
        
        self.gross_salary = round(basic + allowance + ot + bon, 2)
        self.net_salary = round(self.gross_salary - (ded + cpf), 2)
        return self.net_salary

    def to_dict(self):
        emp_name = None
        emp_code = None
        emp_dept = None
        emp_desig = None
        emp_email = None
        if self.employee:
            emp_name = getattr(self.employee, 'full_name', getattr(self.employee, 'name', None))
            emp_code = getattr(self.employee, 'employee_id', None)
            emp_dept = getattr(self.employee, 'department', None)
            emp_desig = getattr(self.employee, 'designation', None)
            emp_email = getattr(self.employee, 'email', None)
            
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': emp_name,
            'employee_code': emp_code,
            'department': emp_dept,
            'designation': emp_desig,
            'email': emp_email,
            'month': self.month,
            'year': self.year,
            'basic_salary': float(self.basic_salary or 0.0),
            'allowances': float(self.allowances or 0.0),
            'overtime_pay': float(self.overtime_pay or 0.0),
            'bonus': float(self.bonus or 0.0),
            'gross_salary': float(self.gross_salary or 0.0),
            'deductions': float(self.deductions or 0.0),
            'cpf_employee': float(self.cpf_employee or 0.0),
            'cpf_employer': float(self.cpf_employer or 0.0),
            'net_salary': float(self.net_salary or 0.0),
            'payment_method': self.payment_method or 'Bank Transfer',
            'payment_status': self.payment_status or 'Pending',
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'notes': self.notes or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


def ensure_salary_schema(engine=None):
    """Ensure salaries table exists."""
    try:
        from sqlalchemy import inspect
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        if 'salaries' not in tables:
            Salary.__table__.create(target_engine, checkfirst=True)
            print("Created salaries table")
    except Exception as e:
        print(f"Error in ensure_salary_schema: {e}")
