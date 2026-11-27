# app/models/employee.py
from app import db
from datetime import datetime

class Employee(db.Model):
    """Employee Model (Singapore Work Pass & Employment)"""
    __tablename__ = 'employees'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200))
    phone_number = db.Column(db.String(20))
    
    # Photo
    photo = db.Column(db.String(255))  # photo file path or filename
    
    # Singapore MOM Work Pass Details (from PDF)
    fin_number = db.Column(db.String(50))            # FIN (e.g. G2266173L)
    work_permit_number = db.Column(db.String(50))    # Work Permit Number
    card_serial_number = db.Column(db.String(50))    # Card Serial Number (e.g. K4462762)
    pass_status = db.Column(db.String(50), default='Valid') # Pass Status (Valid)
    pass_expiry_date = db.Column(db.Date)            # Pass Expires On (e.g. 29 Apr 2028)
    employer = db.Column(db.String(200))             # Employer (e.g. RH SYNERGY (S) PTE. LTD.)
    occupation = db.Column(db.String(200))           # Occupation (e.g. CONSTRUCTION WORKER)
    sector = db.Column(db.String(100))               # Sector (e.g. CONSTRUCTION)
    date_of_application = db.Column(db.Date)         # Date of Application (e.g. 16 Apr 2024)
    pass_issued_date = db.Column(db.Date)            # Pass Issued On (e.g. 8 May 2024)
    pass_renewed_date = db.Column(db.Date)           # Pass Renewed On (e.g. 9 Apr 2026)
    multiple_journey_visa = db.Column(db.String(50), default='Issued') # Multiple Journey Visa (Issued)
    work_pass_attachment = db.Column(db.String(255)) # Work pass document file
    
    # Employment details
    department = db.Column(db.String(100))
    designation = db.Column(db.String(100))
    date_of_joining = db.Column(db.Date)
    current_company = db.Column(db.String(200))
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=True)
    
    # User type field (references name in user_types table)
    user_type = db.Column(db.String(50), nullable=False, default='employee')
    address = db.Column(db.Text)
    
    # Legacy / optional fields preserved for backwards compatibility
    aadhar_card_number = db.Column(db.String(20))
    pan_card_number = db.Column(db.String(20))
    emergency_contact = db.Column(db.String(100))
    blood_group = db.Column(db.String(5))
    marital_status = db.Column(db.String(20))
    aadhar_attachment = db.Column(db.String(255))
    pan_attachment = db.Column(db.String(255))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    company = db.relationship('Company', backref='employees', lazy=True)
    
    def __init__(self, **kwargs):
        super(Employee, self).__init__(**kwargs)
    
    @property
    def name(self):
        """Compatibility property for code accessing employee.name"""
        return self.full_name
    
    def to_dict(self):
        """Convert model to dictionary"""
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'full_name': self.full_name,
            'email': self.email,
            'phone_number': self.phone_number,
            'photo': self.photo,
            
            # Singapore MOM Work Pass Details
            'fin_number': self.fin_number,
            'work_permit_number': self.work_permit_number,
            'card_serial_number': self.card_serial_number,
            'pass_status': self.pass_status or 'Valid',
            'pass_expiry_date': self.pass_expiry_date.isoformat() if hasattr(self.pass_expiry_date, 'isoformat') and self.pass_expiry_date else (str(self.pass_expiry_date) if self.pass_expiry_date else None),
            'employer': self.employer or self.current_company,
            'occupation': self.occupation or self.designation,
            'sector': self.sector,
            'date_of_application': self.date_of_application.isoformat() if hasattr(self.date_of_application, 'isoformat') and self.date_of_application else (str(self.date_of_application) if self.date_of_application else None),
            'pass_issued_date': self.pass_issued_date.isoformat() if hasattr(self.pass_issued_date, 'isoformat') and self.pass_issued_date else (str(self.pass_issued_date) if self.pass_issued_date else None),
            'pass_renewed_date': self.pass_renewed_date.isoformat() if hasattr(self.pass_renewed_date, 'isoformat') and self.pass_renewed_date else (str(self.pass_renewed_date) if self.pass_renewed_date else None),
            'multiple_journey_visa': self.multiple_journey_visa or 'Issued',
            'work_pass_attachment': self.work_pass_attachment or self.aadhar_attachment,
            
            # Employment details
            'department': self.department,
            'designation': self.designation,
            'date_of_joining': self.date_of_joining.isoformat() if hasattr(self.date_of_joining, 'isoformat') and self.date_of_joining else (str(self.date_of_joining) if self.date_of_joining else None),
            'current_company': self.current_company,
            'company_id': self.company_id,
            'user_type': self.user_type,
            'address': self.address,
            
            # Legacy fields
            'aadhar_card_number': self.aadhar_card_number,
            'pan_card_number': self.pan_card_number,
            'emergency_contact': self.emergency_contact,
            'blood_group': self.blood_group,
            'marital_status': self.marital_status,
            'aadhar_attachment': self.aadhar_attachment,
            'pan_attachment': self.pan_attachment,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Employee {self.employee_id} - {self.full_name}>'


def ensure_employee_schema(engine=None):
    """Ensure employees table has all columns for MOM Work Pass details and photo"""
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        if 'employees' in tables:
            columns = {c['name'] for c in inspector.get_columns('employees')}
            with target_engine.connect() as conn:
                col_defs = [
                    ('photo', "VARCHAR(255) NULL"),
                    ('fin_number', "VARCHAR(50) NULL"),
                    ('work_permit_number', "VARCHAR(50) NULL"),
                    ('card_serial_number', "VARCHAR(50) NULL"),
                    ('pass_status', "VARCHAR(50) DEFAULT 'Valid'"),
                    ('pass_expiry_date', "DATE NULL"),
                    ('employer', "VARCHAR(200) NULL"),
                    ('occupation', "VARCHAR(200) NULL"),
                    ('sector', "VARCHAR(100) NULL"),
                    ('date_of_application', "DATE NULL"),
                    ('pass_issued_date', "DATE NULL"),
                    ('pass_renewed_date', "DATE NULL"),
                    ('multiple_journey_visa', "VARCHAR(50) DEFAULT 'Issued'"),
                    ('work_pass_attachment', "VARCHAR(255) NULL"),
                ]
                for col_name, col_sql in col_defs:
                    if col_name not in columns:
                        try:
                            conn.execute(text(f"ALTER TABLE employees ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                            print(f"Added column {col_name} to employees table")
                        except Exception as ex:
                            print(f"Could not add column {col_name}: {ex}")
    except Exception as e:
        print(f"ensure_employee_schema error: {e}")
