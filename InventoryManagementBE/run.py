# run.py
from app import create_app, db
from app.models.delivery_order import ensure_delivery_order_schema
from app.models.attendance import ensure_attendance_schema
from app.models.salary import ensure_salary_schema
from app.models.billing import ensure_billing_schema
from app.models.supplier import ensure_supplier_schema
from app.models.expense import ensure_expense_schema
from app.models.quotation import ensure_quotation_schema

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        ensure_delivery_order_schema(db.engine)
        ensure_attendance_schema(db.engine)
        ensure_salary_schema(db.engine)
        ensure_billing_schema(db.engine)
        ensure_supplier_schema(db.engine)
        ensure_expense_schema(db.engine)
        ensure_quotation_schema(db.engine)
    app.run(debug=True, port=5000)
