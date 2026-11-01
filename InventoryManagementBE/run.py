# run.py
from app import create_app, db
from app.models.delivery_order import ensure_delivery_order_schema

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        ensure_delivery_order_schema(db.engine)
    app.run(debug=True, port=5000)
