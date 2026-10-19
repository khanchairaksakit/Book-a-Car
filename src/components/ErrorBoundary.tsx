import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-72 w-full p-6 flex flex-col items-center justify-center text-center bg-slate-50 border border-slate-200 rounded-3xl my-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 mb-3 shadow-inner">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {this.props.fallbackTitle || 'เกิดข้อผิดพลาดในการแสดงผล'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            ระบบพบข้อผิดพลาดที่ไม่คาดคิดในการเรนเดอร์ส่วนนี้ กรุณากดปุ่มเพื่อลองใหม่อีกครั้ง
          </p>
          {this.state.error && (
            <p className="mt-2 text-[11px] font-mono text-rose-600 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 max-w-lg truncate">
              {this.state.error.message}
            </p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>กลับหน้าหลัก</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
