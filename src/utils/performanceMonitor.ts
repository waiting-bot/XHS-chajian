// 性能指标监控系统

import { PerformanceError } from '../types/error';
import { errorManager } from './errorManager';

// 性能指标接口
export interface PerformanceMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    limit: number;
    percentage: number;
  };
  timing: {
    loadTime: number;
    domReady: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
  network: {
    requests: number;
    transferred: number;
    duration: number;
  };
  custom: {
    [key: string]: number;
  };
}

// 性能配置
export interface PerformanceConfig {
  enableMemoryMonitoring: boolean;
  enableTimingMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  samplingInterval: number;
  memoryThreshold: number; // MB
  timingThreshold: number; // ms
  enableAutoReporting: boolean;
  customMetrics: string[];
}

// 性能告警接口
export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'timing' | 'custom';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  metrics: PerformanceMetrics;
}

// 性能监控管理器
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  customMetrics: Map<string, number> = new Map();
  private isMonitoring = false;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 获取默认配置
  private getDefaultConfig(): PerformanceConfig {
    return {
      enableMemoryMonitoring: true,
      enableTimingMonitoring: true,
      enableNetworkMonitoring: true,
      samplingInterval: 10000, // 10秒
      memoryThreshold: 100, // 100MB
      timingThreshold: 3000, // 3秒
      enableAutoReporting: false,
      customMetrics: []
    };
  }

  // 开始监控
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.collectMetrics();
    
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.samplingInterval);

    console.log('性能监控已启动');
  }

  // 停止监控
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.log('性能监控已停止');
  }

  // 收集性能指标
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        memory: this.config.enableMemoryMonitoring ? this.getMemoryMetrics() : null,
        timing: this.config.enableTimingMonitoring ? this.getTimingMetrics() : null,
        network: this.config.enableNetworkMonitoring ? this.getNetworkMetrics() : null,
        custom: this.getCustomMetrics()
      };

      this.metrics.push(metrics);
      
      // 限制指标数量
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-500);
      }

      // 检查性能告警
      await this.checkPerformanceAlerts(metrics);

      // 检测内存泄漏
      if (this.config.enableMemoryMonitoring) {
        this.detectMemoryLeak();
      }

    } catch (error) {
      console.error('收集性能指标失败:', error);
    }
  }

  // 获取内存指标
  private getMemoryMetrics(): PerformanceMetrics['memory'] {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      return null;
    }

    const memory = (performance as any).memory;
    const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const total = Math.round(memory.totalJSHeapSize / 1024 / 1024);
    const limit = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    const percentage = Math.round((used / limit) * 100);

    return { used, total, limit, percentage };
  }

  // 获取时间指标
  private getTimingMetrics(): PerformanceMetrics['timing'] {
    if (typeof performance === 'undefined' || !performance.timing) {
      return null;
    }

    const timing = performance.timing;
    
    return {
      loadTime: timing.loadEventEnd - timing.navigationStart,
      domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
      firstPaint: this.getFirstPaint(),
      firstContentfulPaint: this.getFirstContentfulPaint()
    };
  }

  // 获取首次绘制时间
  private getFirstPaint(): number {
    if (typeof performance === 'undefined') return 0;
    
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? Math.round(firstPaint.startTime) : 0;
  }

  // 获取首次内容绘制时间
  private getFirstContentfulPaint(): number {
    if (typeof performance === 'undefined') return 0;
    
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : 0;
  }

  // 获取网络指标
  private getNetworkMetrics(): PerformanceMetrics['network'] {
    if (typeof performance === 'undefined') return null;

    try {
      const entries = performance.getEntriesByType('resource');
      const requests = entries.length;
      const transferred = entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      const duration = entries.reduce((sum, entry) => sum + entry.duration, 0);

      return {
        requests,
        transferred: Math.round(transferred / 1024), // KB
        duration: Math.round(duration)
      };
    } catch (error) {
      console.error('获取网络指标失败:', error);
      return null;
    }
  }

  // 获取自定义指标
  private getCustomMetrics(): PerformanceMetrics['custom'] {
    const result: PerformanceMetrics['custom'] = {};
    
    this.customMetrics.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  // 检查性能告警
  private async checkPerformanceAlerts(metrics: PerformanceMetrics): Promise<void> {
    // 内存告警
    if (metrics.memory) {
      if (metrics.memory.percentage > 90) {
        await this.createAlert('memory', 'critical', 
          `内存使用过高: ${metrics.memory.percentage}% (${metrics.memory.used}MB)`,
          metrics.memory.percentage, 90, metrics);
      } else if (metrics.memory.percentage > this.config.memoryThreshold) {
        await this.createAlert('memory', 'warning',
          `内存使用偏高: ${metrics.memory.percentage}% (${metrics.memory.used}MB)`,
          metrics.memory.percentage, this.config.memoryThreshold, metrics);
      }
    }

    // 时间告警
    if (metrics.timing) {
      if (metrics.timing.loadTime > this.config.timingThreshold) {
        await this.createAlert('timing', 'warning',
          `页面加载时间过长: ${metrics.timing.loadTime}ms`,
          metrics.timing.loadTime, this.config.timingThreshold, metrics);
      }
    }
  }

  // 创建性能告警
  private async createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      metrics
    };

    this.alerts.push(alert);
    
    // 限制告警数量
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }

    // 抛出性能错误
    const error = new PerformanceError(
      message,
      type,
      value
    );

    await errorManager.handleError(error);

    console.warn(`性能告警 [${severity.toUpperCase()}]: ${message}`);
  }

  // 检测内存泄漏
  private detectMemoryLeak(): void {
    if (this.metrics.length < 10) return;

    const recentMetrics = this.metrics.slice(-10);
    const memoryUsages = recentMetrics
      .filter(m => m.memory)
      .map(m => m.memory!.used);

    if (memoryUsages.length < 5) return;

    // 计算内存使用趋势
    const trend = this.calculateTrend(memoryUsages);
    
    if (trend > 0.1) { // 10%增长趋势
      const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
      
      if (avgMemory > 50) { // 平均内存超过50MB
        console.warn('检测到可能的内存泄漏趋势:', trend.toFixed(2), '平均内存:', avgMemory.toFixed(2), 'MB');
      }
    }
  }

  // 计算趋势
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;

    return slope / avgY; // 归一化趋势
  }

  // 记录自定义指标
  recordMetric(name: string, value: number): void {
    this.customMetrics.set(name, value);
  }

  // 记录操作耗时
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      this.recordMetric(`operation_${name}`, duration);
      
      // 检查操作是否过慢
      if (duration > 1000) { // 超过1秒
        console.warn(`操作 ${name} 耗时过长: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`operation_${name}_error`, duration);
      throw error;
    }
  }

  // 同步操作耗时测量
  measureSyncOperation<T>(
    name: string,
    operation: () => T
  ): T {
    const startTime = performance.now();
    
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      
      this.recordMetric(`operation_${name}`, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`operation_${name}_error`, duration);
      throw error;
    }
  }

  // 获取性能报告
  getPerformanceReport(): {
    currentMetrics: PerformanceMetrics | null;
    historicalMetrics: PerformanceMetrics[];
    alerts: PerformanceAlert[];
    stats: {
      totalMetrics: number;
      totalAlerts: number;
      avgMemory: number;
      avgLoadTime: number;
      memoryTrend: number;
    };
  } {
    const currentMetrics = this.metrics[this.metrics.length - 1] || null;
    const historicalMetrics = this.metrics.slice(-100); // 最近100个指标
    
    // 计算统计信息
    const memoryMetrics = historicalMetrics
      .filter(m => m.memory)
      .map(m => m.memory!.used);
    
    const timingMetrics = historicalMetrics
      .filter(m => m.timing?.loadTime)
      .map(m => m.timing!.loadTime);

    const avgMemory = memoryMetrics.length > 0 
      ? memoryMetrics.reduce((a, b) => a + b, 0) / memoryMetrics.length 
      : 0;

    const avgLoadTime = timingMetrics.length > 0 
      ? timingMetrics.reduce((a, b) => a + b, 0) / timingMetrics.length 
      : 0;

    const memoryTrend = memoryMetrics.length > 5 
      ? this.calculateTrend(memoryMetrics.slice(-5))
      : 0;

    return {
      currentMetrics,
      historicalMetrics,
      alerts: this.alerts.slice(-20), // 最近20个告警
      stats: {
        totalMetrics: this.metrics.length,
        totalAlerts: this.alerts.length,
        avgMemory,
        avgLoadTime,
        memoryTrend
      }
    };
  }

  // 清除历史数据
  clearHistory(): void {
    this.metrics = [];
    this.alerts = [];
    this.customMetrics.clear();
  }

  // 生成告警ID
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 更新配置
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 如果正在监控，重新启动以应用新配置
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  // 获取配置
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  // 获取监控状态
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

// 全局性能监控实例
export const performanceMonitor = PerformanceMonitor.getInstance();

// 便捷函数
export function recordPerformanceMetric(name: string, value: number): void {
  performanceMonitor.recordMetric(name, value);
}

export async function measurePerformanceOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  return await performanceMonitor.measureOperation(name, operation);
}

export function measurePerformanceSyncOperation<T>(
  name: string,
  operation: () => T
): T {
  return performanceMonitor.measureSyncOperation(name, operation);
}