from app import db
from datetime import datetime


class ProgressClaim(db.Model):
    __tablename__ = 'progress_claims'

    id = db.Column(db.Integer, primary_key=True)
    claim_number = db.Column(db.String(50), unique=True, nullable=False)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=False)

    # Claim details
    claim_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    description = db.Column(db.String(255), nullable=False)
    claim_percentage = db.Column(db.Float, default=0)   # % of quotation total
    claim_amount = db.Column(db.Float, default=0)        # actual SGD amount
    cumulative_claimed = db.Column(db.Float, default=0)  # total claimed so far incl. this

    # Status: draft | submitted | approved | rejected | invoiced
    status = db.Column(db.String(20), default='draft')
    approved_by = db.Column(db.String(100), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    quotation = db.relationship('Quotation', backref=db.backref('progress_claims', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'claimNumber': self.claim_number,
            'quotationId': self.quotation_id,
            'quotationNumber': self.quotation.quotation_number if self.quotation else None,
            'customerName': self.quotation.customer_name if self.quotation else None,
            'quotationTotal': self.quotation.total if self.quotation else 0,
            'claimDate': self.claim_date.isoformat() if self.claim_date else None,
            'description': self.description,
            'claimPercentage': self.claim_percentage,
            'claimAmount': self.claim_amount,
            'cumulativeClaimed': self.cumulative_claimed,
            'status': self.status,
            'approvedBy': self.approved_by,
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'rejectionReason': self.rejection_reason,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }


def ensure_progress_claim_schema(engine=None):
    try:
        from sqlalchemy import inspect
        target_engine = engine or db.engine
        inspector = inspect(target_engine)
        tables = inspector.get_table_names()
        if 'progress_claims' not in tables:
            ProgressClaim.__table__.create(target_engine, checkfirst=True)
            print("Created progress_claims table")
    except Exception as e:
        print(f"Error in ensure_progress_claim_schema: {e}")
