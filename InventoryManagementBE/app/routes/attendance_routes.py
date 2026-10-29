# app/routes/attendance_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime, date
from sqlalchemy import and_, func
from app import db
from app.models import Attendance, Employee
import logging

from flask_cors import CORS

attendance_bp = Blueprint('attendance', __name__)
CORS(attendance_bp)
logger = logging.getLogger(__name__)


# ✅ Check In - Simple check-in without location/device
@attendance_bp.route('/check-in', methods=['POST'])
def check_in():
    """Employee check-in - Simple version"""
    try:
        data = request.get_json() or {}
        current_user_id = None
        
        logger.info(f"Check-in request data: {data}")
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            logger.info(f"JWT Identity: {current_user_id}")
        except:
            pass
        
        # Get employee by user_id, employee_id, or email
        employee = None
        if 'employee_id' in data:
            logger.info(f"Looking for employee by ID: {data['employee_id']}")
            employee = Employee.query.get(data['employee_id'])
        elif 'email' in data:
            logger.info(f"Looking for employee by email: {data['email']}")
            employee = Employee.query.filter_by(email=data['email']).first()
        elif current_user_id:
            logger.info(f"Looking for employee by user ID: {current_user_id}")
            employee = Employee.query.filter_by(id=current_user_id).first()
        
        if not employee:
            logger.error(f"Employee not found. Data: {data}, Current User ID: {current_user_id}")
            # Debug: return all employees for troubleshooting
            all_employees = Employee.query.all()
            return jsonify({
                'error': 'Employee not found. Please provide employee_id or email in request body.',
                'debug_employees_count': len(all_employees),
                'received_data': data
            }), 404
        
        today = date.today()
        
        # Check if already checked in today
        existing_attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if existing_attendance and existing_attendance.check_in_time:
            return jsonify({'error': 'Already checked in today'}), 400
        
        # Create or update attendance record
        if existing_attendance:
            attendance = existing_attendance
            attendance.check_in_time = datetime.now()
            attendance.status = 'present'
        else:
            attendance = Attendance(
                employee_id=employee.id,
                date=today,
                check_in_time=datetime.now(),
                status='present'
            )
            db.session.add(attendance)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Check-in successful',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Check-in error: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': f"Internal server error: {str(e)}"}), 500


# ✅ Check Out - Simple check-out without location/device
@attendance_bp.route('/check-out', methods=['PUT'])
def check_out():
    """Employee check-out - Simple version"""
    try:
        data = request.get_json() or {}
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        # Get employee
        employee = None
        if 'employee_id' in data:
            employee = Employee.query.get(data['employee_id'])
        elif 'email' in data:
            employee = Employee.query.filter_by(email=data['email']).first()
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        
        if not employee:
            return jsonify({'error': 'Employee not found. Please provide employee_id or email in request body.'}), 404
        
        today = date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if not attendance or not attendance.check_in_time:
            return jsonify({'error': 'No check-in record found for today'}), 404
        
        if attendance.check_out_time:
            return jsonify({'error': 'Already checked out today'}), 400
        
        # Set check-out time
        attendance.check_out_time = datetime.now()
        
        # Calculate total hours
        if attendance.check_in_time and attendance.check_out_time:
            time_diff = attendance.check_out_time - attendance.check_in_time
            attendance.total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            # Calculate overtime (assuming 8 hours standard workday)
            standard_hours = 8
            if attendance.total_hours > standard_hours:
                attendance.overtime = round(attendance.total_hours - standard_hours, 2)
        
        attendance.status = 'present'
        db.session.commit()
        
        return jsonify({
            'message': 'Check-out successful',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Check-out error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ✅ Get today's attendance for current user
@attendance_bp.route('/today', methods=['GET'])
def get_today_attendance():
    """Get today's attendance for current user"""
    try:
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee_id = request.args.get('employee_id')
        
        # Get employee
        if employee_id:
            employee = Employee.query.get(employee_id)
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        else:
            return jsonify({'error': 'Please provide employee_id as query parameter or JWT token'}), 400
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        today = date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if attendance:
            return jsonify(attendance.to_dict()), 200
        else:
            return jsonify({
                'employee_id': employee.id,
                'employee_name': employee.name,
                'date': today.isoformat(),
                'check_in_time': None,
                'check_out_time': None,
                'status': 'not_started',
                'total_hours': 0
            }), 200
            
    except Exception as e:
        logger.error(f"Get today's attendance error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get attendance history for current user
@attendance_bp.route('/history', methods=['GET'])
def get_attendance_history():
    """Get attendance history for current user"""
    try:
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee_id = request.args.get('employee_id')
        
        # Get employee
        if employee_id:
            employee = Employee.query.get(employee_id)
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        else:
            return jsonify({'error': 'Please provide employee_id as query parameter or JWT token'}), 400
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        # Get query parameters for filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 30, type=int)
        
        query = Attendance.query.filter(Attendance.employee_id == employee.id)
        
        # Apply filters
        if start_date:
            query = query.filter(Attendance.date >= start_date)
        if end_date:
            query = query.filter(Attendance.date <= end_date)
        
        # Order by date descending and limit
        attendances = query.order_by(Attendance.date.desc()).limit(limit).all()
        
        # Calculate summary
        total_present = sum(1 for a in attendances if a.status == 'present')
        total_absent = sum(1 for a in attendances if a.status == 'absent')
        total_late = sum(1 for a in attendances if a.status == 'late')
        total_hours = sum(a.total_hours or 0 for a in attendances)
        total_overtime = sum(a.overtime or 0 for a in attendances)
        
        return jsonify({
            'attendances': [a.to_dict() for a in attendances],
            'summary': {
                'total_days': len(attendances),
                'present': total_present,
                'absent': total_absent,
                'late': total_late,
                'total_hours': round(total_hours, 2),
                'total_overtime': round(total_overtime, 2)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get attendance history error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get monthly summary for dashboard
@attendance_bp.route('/monthly-summary', methods=['GET'])
def get_monthly_summary():
    """Get monthly attendance summary"""
    try:
        current_user_id = None
        
        # Try to get JWT if provided (optional)
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee_id = request.args.get('employee_id')
        
        # Get employee
        if employee_id:
            employee = Employee.query.get(employee_id)
        elif current_user_id:
            employee = Employee.query.filter_by(id=current_user_id).first()
        else:
            return jsonify({'error': 'Please provide employee_id as query parameter or JWT token'}), 400
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        year = request.args.get('year', datetime.now().year, type=int)
        month = request.args.get('month', datetime.now().month, type=int)
        
        # Get attendance for the month
        attendances = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                func.year(Attendance.date) == year,
                func.month(Attendance.date) == month
            )
        ).all()
        
        # Calculate statistics
        total_days = len(attendances)
        present_days = sum(1 for a in attendances if a.status == 'present')
        absent_days = sum(1 for a in attendances if a.status == 'absent')
        late_days = sum(1 for a in attendances if a.status == 'late')
        total_hours = sum(a.total_hours or 0 for a in attendances)
        
        return jsonify({
            'year': year,
            'month': month,
            'statistics': {
                'total_days': total_days,
                'present': present_days,
                'absent': absent_days,
                'late': late_days,
                'attendance_rate': round((present_days / total_days * 100) if total_days > 0 else 0, 2),
                'total_hours': round(total_hours, 2)
            },
            'attendances': [a.to_dict() for a in attendances]
        }), 200
        
    except Exception as e:
        logger.error(f"Get monthly summary error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get all employees for attendance tracking (Admin)
@attendance_bp.route('/employees', methods=['GET'])
def get_employees():
    """Get list of employees for attendance tracking"""
    try:
        employees = Employee.query.all()
        
        logger.info(f"Total employees in database: {len(employees)}")
        
        return jsonify({
            'total_employees': len(employees),
            'employees': [{
                'id': e.id,
                'employee_id': e.employee_id,
                'full_name': e.full_name,
                'email': e.email,
                'department': e.department,
                'designation': e.designation
            } for e in employees]
        }), 200
        
    except Exception as e:
        logger.error(f"Get employees error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Update attendance record (Admin only)
@attendance_bp.route('/update/<int:attendance_id>', methods=['PUT'])
def update_attendance(attendance_id):
    """Update attendance record (admin only)"""
    try:
        data = request.get_json()
        
        attendance = Attendance.query.get(attendance_id)
        if not attendance:
            return jsonify({'error': 'Attendance record not found'}), 404
        
        # Update fields
        if 'check_in_time' in data:
            attendance.check_in_time = datetime.fromisoformat(data['check_in_time'])
        if 'check_out_time' in data:
            attendance.check_out_time = datetime.fromisoformat(data['check_out_time'])
        if 'status' in data:
            attendance.status = data['status']
        if 'notes' in data:
            attendance.notes = data['notes']
        
        # Recalculate hours if times updated
        if attendance.check_in_time and attendance.check_out_time:
            time_diff = attendance.check_out_time - attendance.check_in_time
            attendance.total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            standard_hours = 8
            if attendance.total_hours > standard_hours:
                attendance.overtime = round(attendance.total_hours - standard_hours, 2)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Attendance updated successfully',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Update attendance error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500