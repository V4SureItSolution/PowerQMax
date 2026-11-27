from flask import Blueprint, request, jsonify
from app import db
from app.models.salary import Salary
from app.models.employee import Employee
from datetime import datetime, date
import logging
from flask_cors import CORS

salary_bp = Blueprint('salary', __name__, url_prefix='/api/salary')
CORS(salary_bp)
logger = logging.getLogger(__name__)

# List all salary records with filters
@salary_bp.route('', methods=['GET'])
@salary_bp.route('/', methods=['GET'])
def get_salaries():
    try:
        query = Salary.query.join(Employee, Salary.employee_id == Employee.id)
        
        # Filters
        month = request.args.get('month')
        year = request.args.get('year', type=int)
        employee_id = request.args.get('employee_id', type=int)
        status = request.args.get('status')
        search = request.args.get('search')
        
        if month and month.lower() != 'all':
            query = query.filter(Salary.month == month)
        if year:
            query = query.filter(Salary.year == year)
        if employee_id:
            query = query.filter(Salary.employee_id == employee_id)
        if status and status.lower() != 'all':
            query = query.filter(Salary.payment_status == status)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Employee.full_name.ilike(search_term)) |
                (Employee.employee_id.ilike(search_term)) |
                (Employee.department.ilike(search_term))
            )
            
        salaries = query.order_by(Salary.year.desc(), Salary.id.desc()).all()
        return jsonify({
            'success': True,
            'count': len(salaries),
            'salaries': [s.to_dict() for s in salaries]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching salaries: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Summary stats for dashboard / salary overview
@salary_bp.route('/stats', methods=['GET'])
def get_salary_stats():
    try:
        year = request.args.get('year', datetime.now().year, type=int)
        month = request.args.get('month')
        
        query = Salary.query
        if year:
            query = query.filter(Salary.year == year)
        if month and month.lower() != 'all':
            query = query.filter(Salary.month == month)
            
        salaries = query.all()
        
        total_payroll = sum(s.net_salary or 0.0 for s in salaries)
        total_gross = sum(s.gross_salary or 0.0 for s in salaries)
        total_paid = sum(s.net_salary or 0.0 for s in salaries if (s.payment_status or '').lower() == 'paid')
        total_pending = sum(s.net_salary or 0.0 for s in salaries if (s.payment_status or '').lower() != 'paid')
        total_deductions = sum((s.deductions or 0.0) + (s.cpf_employee or 0.0) for s in salaries)
        
        paid_count = sum(1 for s in salaries if (s.payment_status or '').lower() == 'paid')
        pending_count = sum(1 for s in salaries if (s.payment_status or '').lower() != 'paid')
        
        return jsonify({
            'success': True,
            'currency': 'SGD',
            'stats': {
                'total_records': len(salaries),
                'total_payroll': round(total_payroll, 2),
                'total_gross': round(total_gross, 2),
                'total_paid': round(total_paid, 2),
                'total_pending': round(total_pending, 2),
                'total_deductions': round(total_deductions, 2),
                'paid_count': paid_count,
                'pending_count': pending_count
            }
        }), 200
    except Exception as e:
        logger.error(f"Error calculating salary stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Get single salary record
@salary_bp.route('/<int:salary_id>', methods=['GET'])
def get_salary(salary_id):
    try:
        salary = Salary.query.get(salary_id)
        if not salary:
            return jsonify({'success': False, 'error': 'Salary record not found'}), 404
        return jsonify({'success': True, 'salary': salary.to_dict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# Create salary record
@salary_bp.route('', methods=['POST'])
@salary_bp.route('/', methods=['POST'])
def create_salary():
    try:
        data = request.get_json() or {}
        employee_id = data.get('employee_id')
        month = data.get('month')
        year = data.get('year', datetime.now().year)
        
        if not employee_id:
            return jsonify({'success': False, 'error': 'Employee is required'}), 400
        if not month:
            return jsonify({'success': False, 'error': 'Month is required'}), 400
            
        employee = Employee.query.get(employee_id)
        if not employee:
            return jsonify({'success': False, 'error': 'Employee not found'}), 404
            
        # Check for existing record
        existing = Salary.query.filter_by(employee_id=employee_id, month=month, year=year).first()
        if existing:
            return jsonify({'success': False, 'error': f'Salary record for {employee.full_name} for {month} {year} already exists.'}), 400
            
        payment_date = None
        if data.get('payment_date'):
            try:
                payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d').date()
            except:
                pass
                
        salary = Salary(
            employee_id=employee_id,
            month=month,
            year=int(year),
            basic_salary=float(data.get('basic_salary') or 0.0),
            allowances=float(data.get('allowances') or 0.0),
            overtime_pay=float(data.get('overtime_pay') or 0.0),
            bonus=float(data.get('bonus') or 0.0),
            deductions=float(data.get('deductions') or 0.0),
            cpf_employee=float(data.get('cpf_employee') or 0.0),
            cpf_employer=float(data.get('cpf_employer') or 0.0),
            payment_method=data.get('payment_method', 'Bank Transfer'),
            payment_status=data.get('payment_status', 'Pending'),
            payment_date=payment_date,
            notes=data.get('notes', '')
        )
        salary.calculate_totals()
        
        db.session.add(salary)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Salary record created successfully',
            'salary': salary.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating salary: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Update salary record
@salary_bp.route('/<int:salary_id>', methods=['PUT'])
def update_salary(salary_id):
    try:
        salary = Salary.query.get(salary_id)
        if not salary:
            return jsonify({'success': False, 'error': 'Salary record not found'}), 404
            
        data = request.get_json() or {}
        
        if 'month' in data:
            salary.month = data['month']
        if 'year' in data:
            salary.year = int(data['year'])
        if 'basic_salary' in data:
            salary.basic_salary = float(data['basic_salary'] or 0.0)
        if 'allowances' in data:
            salary.allowances = float(data['allowances'] or 0.0)
        if 'overtime_pay' in data:
            salary.overtime_pay = float(data['overtime_pay'] or 0.0)
        if 'bonus' in data:
            salary.bonus = float(data['bonus'] or 0.0)
        if 'deductions' in data:
            salary.deductions = float(data['deductions'] or 0.0)
        if 'cpf_employee' in data:
            salary.cpf_employee = float(data['cpf_employee'] or 0.0)
        if 'cpf_employer' in data:
            salary.cpf_employer = float(data['cpf_employer'] or 0.0)
        if 'payment_method' in data:
            salary.payment_method = data['payment_method']
        if 'payment_status' in data:
            salary.payment_status = data['payment_status']
        if 'payment_date' in data:
            if data['payment_date']:
                try:
                    salary.payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d').date()
                except:
                    pass
            else:
                salary.payment_date = None
        if 'notes' in data:
            salary.notes = data['notes']
            
        salary.calculate_totals()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Salary record updated successfully',
            'salary': salary.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating salary: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Update payment status
@salary_bp.route('/<int:salary_id>/status', methods=['PATCH'])
def update_salary_status(salary_id):
    try:
        salary = Salary.query.get(salary_id)
        if not salary:
            return jsonify({'success': False, 'error': 'Salary record not found'}), 404
            
        data = request.get_json() or {}
        new_status = data.get('payment_status', 'Paid')
        salary.payment_status = new_status
        if new_status.lower() == 'paid' and not salary.payment_date:
            salary.payment_date = date.today()
            
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Status updated to {new_status}',
            'salary': salary.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# Delete salary record
@salary_bp.route('/<int:salary_id>', methods=['DELETE'])
def delete_salary(salary_id):
    try:
        salary = Salary.query.get(salary_id)
        if not salary:
            return jsonify({'success': False, 'error': 'Salary record not found'}), 404
            
        db.session.delete(salary)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Salary record deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
