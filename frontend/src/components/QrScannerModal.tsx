import { useEffect, useRef } from 'react'
import { Modal } from 'antd'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  open: boolean
  onScan: (text: string) => void
  onClose: () => void
}

const SCANNER_ID = 'qr-scanner-container'

export default function QrScannerModal({ open, onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const runningRef = useRef(false)

  useEffect(() => {
    if (!open) {
      stopScanner()
      return
    }

    // Đợi DOM render xong mới khởi động
    const timer = setTimeout(() => startScanner(), 300)
    return () => clearTimeout(timer)
  }, [open])

  async function startScanner() {
    if (runningRef.current) return
    try {
      const scanner = new Html5Qrcode(SCANNER_ID)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          if ('vibrate' in navigator) navigator.vibrate(100)
          stopScanner()
          onScan(text.trim().toUpperCase())
        },
        undefined
      )
      runningRef.current = true
    } catch (err) {
      console.error('QR scanner error:', err)
    }
  }

  async function stopScanner() {
    if (!runningRef.current || !scannerRef.current) return
    try {
      await scannerRef.current.stop()
      scannerRef.current.clear()
    } catch {}
    runningRef.current = false
    scannerRef.current = null
  }

  function handleClose() {
    stopScanner()
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title="Quét mã QR / Barcode"
      centered
      destroyOnClose
      styles={{ body: { padding: '16px 0 0' } }}
    >
      <div
        id={SCANNER_ID}
        style={{ width: '100%', minHeight: 280 }}
      />
      <p style={{ textAlign: 'center', color: '#8c8c8c', fontSize: 13, marginTop: 12 }}>
        Hướng camera vào mã QR trên phiếu lệnh sản xuất
      </p>
    </Modal>
  )
}
