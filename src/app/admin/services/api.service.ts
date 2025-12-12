// src/app/admin/services/api.service.ts

import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'https://agrodeliserdang.rafajayacrane.com/api';

  constructor(private http: HttpClient) {}

  /**
   * Get HTTP Headers with Bearer Token
   * Token diambil langsung dari localStorage yang di-set oleh AuthService
   */
  private getHeaders(contentType?: string): HttpHeaders {
    let headers = new HttpHeaders();

    // Ambil token dari localStorage (di-set oleh AuthService)
    const token = localStorage.getItem('token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    if (contentType) {
      headers = headers.set('Content-Type', contentType);
    }

    return headers;
  }

  /**
   * GET request
   */
  get<T = any>(endpoint: string, params?: any): Observable<ApiResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] != null) {
          httpParams = httpParams.append(key, params[key].toString());
        }
      });
    }
    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, {
        headers: this.getHeaders(),
        params: httpParams,
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * POST request with JSON body
   */
  post<T = any>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, body, {
        headers: this.getHeaders('application/json'),
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * POST request with FormData (multipart/form-data)
   * NOTE: Jangan set Content-Type manual untuk FormData
   * Browser akan otomatis set dengan boundary yang benar
   */
  postFormData<T = any>(endpoint: string, formData: FormData): Observable<ApiResponse<T>> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, formData, {
        headers: this.getHeaders(), // Jangan set Content-Type untuk FormData
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * POST request - convert object to FormData
   */
  postMultipart<T = any>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const formData = this.objectToFormData(data);
    return this.postFormData<T>(endpoint, formData);
  }

  /**
   * PUT request with JSON body
   */
  put<T = any>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http
      .put<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, body, {
        headers: this.getHeaders('application/json'),
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * PUT request with FormData
   */
  putFormData<T = any>(endpoint: string, formData: FormData): Observable<ApiResponse<T>> {
    return this.http
      .put<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, formData, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * PUT request - convert object to FormData
   */
  putMultipart<T = any>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const formData = this.objectToFormData(data);
    return this.putFormData<T>(endpoint, formData);
  }

  /**
   * DELETE request
   */
  delete<T = any>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http
      .delete<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * Upload single file
   */
  uploadFile<T = any>(
    endpoint: string,
    file: File,
    additionalData?: any
  ): Observable<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    if (additionalData) {
      Object.keys(additionalData).forEach((key) => {
        formData.append(key, additionalData[key]);
      });
    }
    return this.postFormData<T>(endpoint, formData);
  }

  /**
   * Download file
   */
  downloadFile(endpoint: string, filename: string): Observable<void> {
    return new Observable((observer) => {
      this.http
        .get(`${this.baseUrl}/${endpoint}`, {
          headers: this.getHeaders(),
          responseType: 'blob',
        })
        .subscribe({
          next: (blob) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
            observer.next();
            observer.complete();
          },
          error: (error) => observer.error(error),
        });
    });
  }

  /**
   * Convert object to FormData
   */
  private objectToFormData(obj: any, formData = new FormData(), parentKey = ''): FormData {
    if (obj == null) return formData;

    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      // ✅ Skip undefined dan null values
      if (value === undefined || value === null) return;

      const formKey = parentKey ? `${parentKey}[${key}]` : key;

      if (value instanceof File) {
        formData.append(formKey, value);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item instanceof File) {
            formData.append(`${formKey}[${index}]`, item);
          } else if (typeof item === 'object' && item !== null) {
            this.objectToFormData(item, formData, `${formKey}[${index}]`);
          } else if (item !== null && item !== undefined) {
            // ✅ Skip null/undefined
            formData.append(`${formKey}[${index}]`, item.toString());
          }
        });
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        this.objectToFormData(value, formData, formKey);
      } else {
        // ✅ Convert value to string dengan aman
        formData.append(formKey, value.toString());
      }
    });

    return formData;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'Terjadi kesalahan pada server';

    if (error.status === 0) {
      errorMessage = 'Tidak dapat terhubung ke server';
    } else if (error.status === 400) {
      errorMessage = error.error?.message || 'Request tidak valid';
    } else if (error.status === 401) {
      errorMessage = 'Unauthorized. Silakan login kembali';
      // Optional: Redirect ke login page
      // window.location.href = '/login';
    } else if (error.status === 403) {
      errorMessage = 'Akses ditolak';
    } else if (error.status === 404) {
      errorMessage = 'Resource tidak ditemukan';
    } else if (error.status === 422) {
      errorMessage = error.error?.message || 'Validasi gagal';
    } else if (error.status === 500) {
      errorMessage = 'Terjadi kesalahan pada server';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    console.error('API Error:', error);
    return throwError(() => ({ message: errorMessage, error }));
  }
}
