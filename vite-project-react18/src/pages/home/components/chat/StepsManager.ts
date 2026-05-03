import { ProcessStep, StepStatus } from './types';

interface AddStepOptions {
  key?: string;
  status?: StepStatus;
}

interface UpdateStepOptions {
  status?: StepStatus;
  content?: string;
  tooltip?: string;
}

export class StepsManager {
  private steps: ProcessStep[] = [];
  private callback: (steps: ProcessStep[]) => void;
  private stepKeys = new Map<string, string>();

  constructor(callback: (steps: ProcessStep[]) => void) {
    this.callback = callback;
  }

  setCallback(callback: (steps: ProcessStep[]) => void): void {
    this.callback = callback;
  }

  addStep(content: string, tooltip: string = '', options: AddStepOptions = {}): string {
    const step: ProcessStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      content,
      tooltip,
      status: options.status ?? 'waiting',
      timestamp: new Date()
    };

    this.steps.push(step);

    if (options.key) {
      this.stepKeys.set(options.key, step.id);
    }

    this.emit();
    return step.id;
  }

  updateStep(stepIdOrKey: string, options: UpdateStepOptions): void {
    const stepId = this.resolveStepId(stepIdOrKey);
    if (!stepId) {
      return;
    }

    this.steps = this.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          ...(options.status ? { status: options.status } : {}),
          ...(options.content !== undefined ? { content: options.content } : {}),
          ...(options.tooltip !== undefined ? { tooltip: options.tooltip } : {}),
          timestamp: new Date()
        };
      }
      return step;
    });

    this.emit();
  }

  clearSteps(): void {
    this.steps = [];
    this.stepKeys.clear();
    this.emit();
  }

  getSteps(): ProcessStep[] {
    return this.steps.map(step => ({ ...step }));
  }

  getStep(stepIdOrKey: string): ProcessStep | undefined {
    const stepId = this.resolveStepId(stepIdOrKey);
    if (!stepId) {
      return undefined;
    }

    const step = this.steps.find(item => item.id === stepId);
    return step ? { ...step } : undefined;
  }

  settleUnfinishedSteps(status: Extract<StepStatus, 'completed' | 'error'>, tooltip?: string): void {
    this.steps = this.steps.map(step => {
      if (step.status === 'completed' || step.status === 'error') {
        return step;
      }

      return {
        ...step,
        status,
        ...(tooltip !== undefined ? { tooltip } : {}),
        timestamp: new Date()
      };
    });

    this.emit();
  }

  private resolveStepId(stepIdOrKey: string): string | undefined {
    return this.stepKeys.get(stepIdOrKey) ?? stepIdOrKey;
  }

  private emit(): void {
    this.callback(this.getSteps());
  }

  // 便捷方法
  startProcessing(stepIdOrKey: string): void {
    this.updateStep(stepIdOrKey, { status: 'processing' });
  }

  completeStep(stepIdOrKey: string): void {
    this.updateStep(stepIdOrKey, { status: 'completed' });
  }

  errorStep(stepIdOrKey: string, tooltip?: string): void {
    this.updateStep(stepIdOrKey, {
      status: 'error',
      ...(tooltip !== undefined ? { tooltip } : {})
    });
  }
}
