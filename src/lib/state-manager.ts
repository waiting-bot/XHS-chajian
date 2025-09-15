export class CollectionState {
  static currentState: 'idle' | 'collecting' | 'uploading' | 'success' | 'error' = 'idle';
  static errorMessage: string | null = null;
  
  static startCollecting() {
    this.currentState = 'collecting';
    this.errorMessage = null;
  }
  
  static startUploading() {
    this.currentState = 'uploading';
  }
  
  static markSuccess() {
    this.currentState = 'success';
    setTimeout(() => this.reset(), 3000);
  }
  
  static markError(message: string) {
    this.currentState = 'error';
    this.errorMessage = message;
    setTimeout(() => this.reset(), 5000);
  }
  
  static reset() {
    this.currentState = 'idle';
    this.errorMessage = null;
  }
}