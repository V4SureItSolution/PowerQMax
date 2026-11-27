from app import db
from datetime import datetime, date

class Expense(db.Model):
    """
    Expense / Payment model for tracking business expenses and payments,
    due date management, partial payments, categories, and receipts.
    """
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)  # Total committed/bill amount
    expense_date = db.Column(db.Date, nullable=False, default=date.today)
    due_date = db.Column(db.Date, nullable=True)  # Due date for payment
    category = db.Column(db.String(100), nullable=False, default='General')  # Manual entry
    payment_method = db.Column(db.String(50), nullable=True, default='Cash')
    reference_number = db.Column(db.String(100), nullable=True)
    bill_attachment = db.Column(db.String(255), nullable=True)
    bill_original_name = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to multiple partial payments
    partial_payments = db.relationship(
        'ExpensePartialPayment',
        backref='expense',
        lazy=True,
        cascade='all, delete-orphan',
        order_by='ExpensePartialPayment.payment_date.desc(), ExpensePartialPayment.id.desc()'
    )

    @property
    def total_paid(self):
        """Sum of all recorded partial payments"""
        if self.partial_payments:
            return round(sum(float(p.amount_paid or 0.0) for p in self.partial_payments), 2)
        return 0.0

    @property
    def remaining_amount(self):
        """Remaining balance = Total amount - Total paid (minimum 0)"""
        tot = float(self.amount or 0.0)
        paid = self.total_paid
        return round(max(0.0, tot - paid), 2)

    @property
    def last_payment_date(self):
        """Date of the most recent partial payment"""
        if self.partial_payments:
            dates = [p.payment_date for p in self.partial_payments if p.payment_date]
            if dates:
                return max(dates)
        return None

    @property
    def payment_status(self):
        """
        Payment status:
        - Paid: Entire amount has been paid (remaining_amount <= 0).
        - Overdue: Due date has passed and remaining_amount > 0.
        - Partially Paid: Some amount has been paid, but full amount is still pending.
        - Pending: No payment has been made yet.
        """
        tot = float(self.amount or 0.0)
        paid = self.total_paid
        remaining = self.remaining_amount
        today = date.today()

        if paid >= tot and tot > 0:
            return "Paid"
        elif self.due_date and self.due_date < today and remaining > 0:
            return "Overdue"
        elif paid > 0 and remaining > 0:
            return "Partially Paid"
        else:
            return "Pending"

    @property
    def due_status(self):
        """
        Due status:
        - Settled: Fully paid
        - Overdue: Due date is before today
        - Due Today: Due date is today
        - Upcoming: Due date is after today
        - No Due Date: No due date specified
        """
        if self.payment_status == "Paid":
            return "Settled"
        if not self.due_date:
            return "No Due Date"

        today = date.today()
        if self.due_date < today:
            return "Overdue"
        elif self.due_date == today:
            return "Due Today"
        else:
            return "Upcoming"

    @property
    def days_until_due(self):
        if not self.due_date:
            return None
        today = date.today()
        return (self.due_date - today).days

    def to_dict(self):
        """Convert expense object to dictionary for API responses"""
        payments = [p.to_dict() for p in self.partial_payments] if self.partial_payments else []
        tot = float(self.amount or 0.0)
        paid = self.total_paid
        rem = self.remaining_amount
        last_d = self.last_payment_date

        return {
            'id': self.id,
            'description': self.description,
            'amount': tot,
            'total_amount': tot,
            'total_paid': paid,
            'remaining_amount': rem,
            'expense_date': self.expense_date.strftime('%Y-%m-%d') if self.expense_date else None,
            'due_date': self.due_date.strftime('%Y-%m-%d') if self.due_date else None,
            'category': self.category or 'General',
            'payment_method': self.payment_method or 'Cash',
            'payment_status': self.payment_status,
            'due_status': self.due_status,
            'days_until_due': self.days_until_due,
            'last_payment_date': last_d.strftime('%Y-%m-%d') if last_d else None,
            'reference_number': self.reference_number,
            'bill_attachment': self.bill_attachment,
            'bill_original_name': self.bill_original_name,
            'bill_url': f"/uploads/{self.bill_attachment}" if self.bill_attachment else None,
            'notes': self.notes or '',
            'partial_payments': payments,
            'payments_count': len(payments),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<Expense {self.id}: {self.description} - Total: ${self.amount}, Paid: ${self.total_paid}, Status: {self.payment_status}>'


class ExpensePartialPayment(db.Model):
    """
    Partial payment records against an Expense/Payment entry.
    """
    __tablename__ = 'expense_partial_payments'

    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.Integer, db.ForeignKey('expenses.id', ondelete='CASCADE'), nullable=False)
    amount_paid = db.Column(db.Numeric(10, 2), nullable=False)
    payment_date = db.Column(db.Date, nullable=False, default=date.today)
    payment_mode = db.Column(db.String(50), nullable=False, default='Cash')
    remarks = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'expense_id': self.expense_id,
            'amount_paid': float(self.amount_paid) if self.amount_paid is not None else 0.0,
            'payment_date': self.payment_date.strftime('%Y-%m-%d') if self.payment_date else None,
            'payment_mode': self.payment_mode or 'Cash',
            'remarks': self.remarks or '',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<ExpensePartialPayment {self.id} for Expense {self.expense_id}: ${self.amount_paid} on {self.payment_date}>'


def ensure_expense_schema(engine=None):
    """
    Ensures the expenses and expense_partial_payments tables exist and have all required columns.
    Safe for SQLite, MySQL, and PostgreSQL.
    """
    try:
        from sqlalchemy import inspect, text
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()

        # 1. Ensure expenses table
        if 'expenses' not in tables:
            Expense.__table__.create(target_engine, checkfirst=True)
            print("✅ 'expenses' table created successfully.")
        else:
            columns = {c['name'] for c in inspector.get_columns('expenses')}
            col_defs = [
                ('description', "TEXT NOT NULL"),
                ('amount', "DECIMAL(10, 2) NOT NULL DEFAULT 0.00"),
                ('expense_date', "DATE NOT NULL"),
                ('due_date', "DATE NULL"),
                ('category', "VARCHAR(100) NOT NULL DEFAULT 'General'"),
                ('payment_method', "VARCHAR(50) NOT NULL DEFAULT 'Cash'"),
                ('reference_number', "VARCHAR(100) NULL"),
                ('bill_attachment', "VARCHAR(255) NULL"),
                ('bill_original_name', "VARCHAR(255) NULL"),
                ('notes', "TEXT NULL"),
                ('created_at', "DATETIME DEFAULT CURRENT_TIMESTAMP"),
                ('updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
            ]

            is_mysql = 'mysql' in str(target_engine.url).lower()
            with target_engine.connect() as conn:
                for col_name, col_sql in col_defs:
                    if col_name not in columns:
                        try:
                            if is_mysql:
                                conn.execute(text(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_sql}"))
                            else:
                                conn.execute(text(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_sql.split('AFTER')[0]}"))
                            conn.commit()
                            print(f"✅ Added missing column '{col_name}' to expenses table")
                        except Exception as col_err:
                            print(f"Column '{col_name}' check/add notice: {col_err}")

        # 2. Ensure expense_partial_payments table
        tables_updated = inspector.get_table_names()
        if 'expense_partial_payments' not in tables_updated:
            ExpensePartialPayment.__table__.create(target_engine, checkfirst=True)
            print("✅ 'expense_partial_payments' table created successfully.")
        else:
            p_columns = {c['name'] for c in inspector.get_columns('expense_partial_payments')}
            p_col_defs = [
                ('expense_id', "INT NOT NULL"),
                ('amount_paid', "DECIMAL(10, 2) NOT NULL DEFAULT 0.00"),
                ('payment_date', "DATE NOT NULL"),
                ('payment_mode', "VARCHAR(50) NOT NULL DEFAULT 'Cash'"),
                ('remarks', "TEXT NULL"),
                ('created_at', "DATETIME DEFAULT CURRENT_TIMESTAMP")
            ]
            with target_engine.connect() as conn:
                for col_name, col_sql in p_col_defs:
                    if col_name not in p_columns:
                        try:
                            conn.execute(text(f"ALTER TABLE expense_partial_payments ADD COLUMN {col_name} {col_sql}"))
                            conn.commit()
                            print(f"✅ Added missing column '{col_name}' to expense_partial_payments table")
                        except Exception as p_err:
                            print(f"Partial payment column '{col_name}' notice: {p_err}")

        # 3. Check legacy expenses and backfill initial payments if due_date is null and no payments exist
        try:
            with target_engine.connect() as conn:
                # Find expenses with no payments and backfill
                legacy_res = conn.execute(text("""
                    SELECT e.id, e.amount, e.expense_date, e.payment_method 
                    FROM expenses e 
                    LEFT JOIN expense_partial_payments p ON e.id = p.expense_id 
                    WHERE p.id IS NULL AND e.due_date IS NULL AND e.amount > 0
                """)).fetchall()

                for row in legacy_res:
                    exp_id = row[0]
                    amt = row[1]
                    p_date = row[2] or date.today()
                    p_mode = row[3] or 'Cash'
                    conn.execute(text("""
                        INSERT INTO expense_partial_payments 
                        (expense_id, amount_paid, payment_date, payment_mode, remarks, created_at)
                        VALUES (:exp_id, :amt, :p_date, :p_mode, 'Legacy payment', NOW())
                    """), {
                        'exp_id': exp_id,
                        'amt': amt,
                        'p_date': p_date,
                        'p_mode': p_mode
                    })
                if legacy_res:
                    conn.commit()
                    print(f"✅ Backfilled {len(legacy_res)} legacy expenses into partial payments")
        except Exception as b_err:
            print(f"Notice during legacy expense check: {b_err}")

    except Exception as e:
        print(f"Error in ensure_expense_schema: {e}")
