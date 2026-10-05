import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, Upload, SwitchCamera, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onCapture: (base64Image: string) => void;
  onClose: () => void;
  preferredFacingMode?: 'environment' | 'user';
}

export default function CameraCaptureModal({
  isOpen,
  title,
  subtitle,
  onCapture,
  onClose,
  preferredFacingMode = 'environment',
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(preferredFacingMode);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);

  // Initialize and stop camera stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      if (!isOpen || capturedPreview) return;
      setIsStarting(true);
      setCameraError(null);

      // Stop previous stream if any
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการเปิดสตรีมกล้องสดโดยตรง');
        }

        let mediaStream: MediaStream | null = null;

        // Try sequential constraints from highest quality to generic fallback
        const attempts: MediaStreamConstraints[] = [
          {
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          {
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          },
          {
            video: true,
            audio: false,
          },
        ];

        let lastErr: any = null;
        for (const constraint of attempts) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
            if (mediaStream) break;
          } catch (e) {
            lastErr = e;
          }
        }

        if (!mediaStream) {
          throw lastErr || new Error('ไม่สามารถเข้าถึงอุปกรณ์กล้องได้');
        }

        currentStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute('playsinline', 'true');
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video play error:', playErr);
          }
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        let msg = 'เปิดกล้องถ่ายภาพของอุปกรณ์โดยตรง';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError') {
          msg = 'เบราว์เซอร์หรือความปลอดภัยจำกัดสตรีมกล้องสดในหน้านี้ กรุณากดปุ่มด้านล่างเพื่อเปิดกล้องถ่ายภาพของอุปกรณ์ทันที';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'ไม่พบอุปกรณ์สตรีมกล้องสด กรุณากดปุ่มด้านล่างเพื่อเปิดกล้องถ่ายภาพของอุปกรณ์หรือเลือกรูปภาพ';
        } else {
          msg = 'กรุณากดปุ่มด้านล่างเพื่อเปิดกล้องถ่ายภาพของอุปกรณ์ทันที';
        }
        setCameraError(msg);
      } finally {
        setIsStarting(false);
      }
    }

    if (isOpen) {
      startCamera();
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode, capturedPreview]);

  // Ensure video element receives stream when element mounts
  useEffect(() => {
    if (videoRef.current && stream && !capturedPreview) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.warn('Video play sync error:', err));
      }
    }
  }, [stream, capturedPreview]);

  // Clean up stream on unmount or close
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCapturedPreview(null);
    setCameraError(null);
    onClose();
  };

  // Toggle front / back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture current video frame to base64
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Trigger visual flash animation
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If using user-facing camera, mirror the image horizontally for natural look
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Stop stream while viewing preview
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    setCapturedPreview(dataUrl);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPreview(null);
    // Restart camera stream by state effect
  };

  // Confirm and use captured photo
  const handleConfirmPhoto = () => {
    if (capturedPreview) {
      onCapture(capturedPreview);
      handleClose();
    }
  };

  // Fallback: upload file from disk
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedPreview(dataUrl);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5"
      onClick={handleClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="ปิดกล้อง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport / Captured Preview Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] sm:min-h-[360px] overflow-hidden">
          {flashEffect && (
            <div className="absolute inset-0 bg-white z-40 transition-opacity duration-200 pointer-events-none" />
          )}

          {capturedPreview ? (
            /* 1. Captured Photo Preview */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedPreview}
                alt="Captured Preview"
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-lg"
              />
              <div className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>ถ่ายภาพเรียบร้อยแล้ว</span>
              </div>
            </div>
          ) : cameraError ? (
            /* 2. Error Message + Fallback Native Camera & File Chooser */
            <div className="p-6 text-center text-slate-300 space-y-4 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                <Camera className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-white text-base">เปิดกล้องถ่ายภาพของอุปกรณ์</p>
                <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  id="btn-modal-trigger-native-camera"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>📸 กดเปิดกล้องถ่ายภาพทันที (Camera)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>เลือกรูปภาพจากคลังภาพในเครื่อง</span>
                </button>
              </div>
            </div>
          ) : (
            /* 3. Live Video Viewfinder */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover max-h-[55vh] ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Target Guidelines */}
              <div className="absolute inset-6 border-2 border-dashed border-white/40 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                </div>
                <div className="text-center">
                  <span className="bg-black/60 backdrop-blur-xs text-white/90 text-[10px] sm:text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                    จัดวัตถุให้อยู่ในกรอบภาพ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              {/* Camera Switch / Flip Button (top right inside viewfinder) */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md shadow-md border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                title="สลับกล้องหน้า / หลัง"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>

              {isStarting && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>กำลังเปิดกล้อง...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden Fallback Native Camera Input (triggers native camera app directly) */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
          id="camera-native-capture-input"
        />

        {/* Hidden File Picker Input (triggers gallery/file chooser) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="camera-fallback-file-input"
        />

        {/* Footer Action Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800/80 shrink-0">
          {capturedPreview ? (
            /* Action Buttons after Photo is Captured */
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 px-4 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ถ่ายใหม่</span>
              </button>
              <button
                type="button"
                id="btn-confirm-captured-photo"
                onClick={handleConfirmPhoto}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>ใช้รูปนี้</span>
              </button>
            </div>
          ) : (
            /* Shutter and File Upload Controls */
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-800"
                title="เลือกรูปภาพจากเครื่องแทน"
              >
                <Upload className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">เลือกรูปจากเครื่อง</span>
              </button>

              {/* Big Circular Shutter Button */}
              <button
                type="button"
                id="btn-camera-shutter"
                disabled={isStarting}
                onClick={() => {
                  if (cameraError) {
                    nativeCameraInputRef.current?.click();
                  } else {
                    handleCapturePhoto();
                  }
                }}
                className="w-16 h-16 rounded-full border-4 border-white bg-red-600 hover:bg-red-500 active:scale-90 transition-transform shadow-xl flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group mx-auto"
                title={cameraError ? 'กดเพื่อเปิดกล้องถ่ายภาพ' : 'กดเพื่อถ่ายภาพ'}
              >
                <div className="w-11 h-11 rounded-full bg-white/20 group-hover:scale-95 transition-transform flex items-center justify-center text-white">
                  {cameraError && <Camera className="w-5 h-5 text-white" />}
                </div>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-3 py-2 rounded-xl hover:bg-slate-800"
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
