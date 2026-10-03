import { Component } from 'react';
import { ErrorState } from './States';

/** Keeps a rendering error in one page from blanking the whole app. Reset by changing `resetKey`. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This page failed to load"
          error={{ message: 'An unexpected error occurred. Try again, or go back to the previous page.' }}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
