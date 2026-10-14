import React from 'react';
import { Vehicle } from '../types';
import { VehicleBookingAlert } from '../utils/vehicleAlerts';
import {
  AlertTriangle,
  AlertCircle,
  Wrench,
  Disc,
  Calendar,
  CheckCircle2,
  Car,
  X,
  Gauge,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VehicleMaintenanceAlertModalProps {
  isOpen: boolean;
  vehicle: Vehicle | null;
  alerts: VehicleBookingAlert[];
  onAcknowledge: () => void;
  onCancelOrChangeVehicle?: () => void;
}

export default function VehicleMaintenanceAlertModal({
  isOpen,
  vehicle,
  alerts,
  onAcknowledge,
  onCancelOrChangeVehicle,
}: VehicleMaintenanceAlertModalProps) {
  if (!isOpen || !vehicle || alerts.length === 0) return null;

  const hasCritical = alerts.some((a) => a.severity === 'critical');

  const getAlertIcon = (type: VehicleBookingAlert['type']) => {
    switch (type) {
      case 'mileage':
        return <Wrench className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'tires':
        return <Disc className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'tax':
        return <Calendar className="w-5 h-5 text-amber-600 shrink-0" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-200 flex flex-col max-h-[90vh]"
          id="vehicle-maintenance-alert-modal"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div
            className={`p-5 text-white ${
              hasCritical
                ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700'
                : 'bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100 block">
                    แจ้งเตือนการบำรุงรักษารถยนต์
                  </span>
                  <h3 className="text-lg font-bold leading-tight">
                    {hasCritical
                      ? 'รถยนต์มีรายการถึง/เกินกำหนดซ่อมบำรุง!'
                      : 'รถยนต์ใกล้ถึงกำหนดซ่อมบำรุง'}
                  </h3>
                </div>
              </div>
              {onCancelOrChangeVehicle && (
                <button
                  type="button"
                  onClick={onCancelOrChangeVehicle}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Target Vehicle Summary Card */}
            <div className="mt-3.5 bg-black/20 backdrop-blur-xs rounded-xl p-3 border border-white/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Car className="w-4 h-4 text-amber-200 shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-sm block truncate text-white">
                    {vehicle.brand} {vehicle.model}
                  </span>
                  <span className="text-xs text-amber-100 font-mono">
                    ทะเบียน: {vehicle.plateNumber}
                  </span>
                </div>
              </div>
              {vehicle.currentMileage !== undefined && (
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-amber-200 block">เลขไมล์ปัจจุบัน</span>
                  <span className="font-mono font-bold text-sm text-white">
                    {vehicle.currentMileage.toLocaleString()} กม.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Body / Alerts List */}
          <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-950">
                  แจ้งเตือนล่วงหน้า 1,000 กิโลเมตร / ภาษี 1 เดือน
                </p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  ระบบจะแจ้งเตือนเมื่อเลขไมล์ใกล้ถึงรอบเช็คระยะ หรือใกล้ถึงรอบเปลี่ยนยางก่อน 1,000 กม.
                  (และภาษีก่อนหมดอายุ 1 เดือน) จนกว่าจะผ่านการตรวจเช็คหรือเปลี่ยนรอบใหม่
                </p>
              </div>
            </div>

            {/* List of active alerts for this vehicle */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-gray-700 block">
                รายการที่ต้องเฝ้าระวังหรือใกล้ถึงกำหนด ({alerts.length} รายการ):
              </span>

              {alerts.map((alert, idx) => {
                const isCrit = alert.severity === 'critical';
                return (
                  <div
                    key={`${alert.type}-${idx}`}
                    className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                      isCrit
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isCrit ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {getAlertIcon(alert.type)}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm">{alert.title}</h4>
                          <span
                            className={`text-[10px] font-semibold block ${
                              isCrit ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            {alert.shortLabel}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 border ${
                          isCrit
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {alert.badge}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed pl-9">
                      {alert.description}
                    </p>

                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-gray-200/60 pl-9 font-mono text-gray-600">
                      <span>ค่าปัจจุบัน: <strong className="text-gray-900">{alert.currentValueText}</strong></span>
                      <span>เป้าหมาย/กำหนด: <strong className="text-gray-900">{alert.targetValueText}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer / Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {onCancelOrChangeVehicle && (
              <button
                id="btn-alert-change-vehicle"
                type="button"
                onClick={onCancelOrChangeVehicle}
                className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                เลือกเปลี่ยนรถคันอื่น
              </button>
            )}
            <button
              id="btn-alert-acknowledge-proceed"
              type="button"
              onClick={onAcknowledge}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                hasCritical
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>รับทราบและดำเนินการต่อ</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
