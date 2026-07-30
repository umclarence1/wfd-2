import { Component } from 'react';

export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AdminErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-[#111827] p-6 text-sm text-rose-200">
          <p className="font-bold text-white">Something went wrong in the admin panel.</p>
          <p className="mt-2 text-rose-300/90">
            {this.state.error?.message || 'Unexpected render error.'}
          </p>
          <button
            type="button"
            className="admin-gold-btn mt-4"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
