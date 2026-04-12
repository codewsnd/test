import { ProcessStep, StepStatus } from './types';

export class StepsManager {
  private steps: ProcessStep[] = [];
  public callback: (steps: ProcessStep[]) => void;

  constructor(callback: (steps: ProcessStep[]) => void) {
    this.callback = callback;
  }

  addStep(content: string, tooltip: string = ''): string {
    const step: ProcessStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      content,
      tooltip,
      status: 'waiting',
      timestamp: new Date()
    };

    this.steps.push(step);
    this.callback([...this.steps]);
    return step.id;
  }

  updateStep(stepId: string, status: StepStatus, content?: string, tooltip?: string): void {
    this.steps = this.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          status,
          ...(content && { content }),
          ...(tooltip && { tooltip }),
          timestamp: new Date()
        };
      }
      return step;
    });

    this.callback([...this.steps]);
  }

  clearSteps(): void {
    this.steps = [];
    this.callback([]);
  }

  getSteps(): ProcessStep[] {
    return [...this.steps];
  }

  // 便捷方法
  startProcessing(stepId: string): void {
    this.updateStep(stepId, 'processing');
  }

  completeStep(stepId: string): void {
    this.updateStep(stepId, 'completed');
  }

  errorStep(stepId: string): void {
    this.updateStep(stepId, 'error');
  }
}
