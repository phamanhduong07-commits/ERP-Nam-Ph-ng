import React from 'react'
import { Alert, Button } from 'antd'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      const isDev = import.meta.env.DEV

      return (
        <div style={{ padding: 24 }}>
          <Alert
            type="error"
            message="Lỗi hiển thị trang"
            description={
              isDev ? (
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              ) : (
                'Trang này đang gặp lỗi hiển thị. Vui lòng thử tải lại hoặc quay lại sau.'
              )
            }
          />
          <Button style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>
            Thử lại
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
