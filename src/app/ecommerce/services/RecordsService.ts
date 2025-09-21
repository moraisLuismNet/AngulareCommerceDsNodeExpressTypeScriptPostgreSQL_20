import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, tap, map, catchError, throwError } from "rxjs";
import { environment } from "src/environments/environment";
import { AuthGuard } from "src/app/guards/AuthGuardService";
import { IRecord } from "../EcommerceInterface";
import { StockService } from "./StockService";

@Injectable({
  providedIn: "root",
})
export class RecordsService {
  urlAPI = environment.urlAPI;
  constructor(
    private http: HttpClient,
    private authGuard: AuthGuard,
    private stockService: StockService
  ) {}

  getRecords(): Observable<IRecord[]> {
    const headers = this.getHeaders();
    
    return this.http.get<any>(`${this.urlAPI}records`, { 
      headers,
      observe: 'response' // Get full response including status and headers
    }).pipe(
      map((response) => {
        const body = response.body;
        
        if (!body) {
          console.warn('Empty response body');
          return [];
        }
        
        // Handle different possible response structures
        const records = body.$values || body.data || (Array.isArray(body) ? body : []);
        
        if (!Array.isArray(records)) {
          console.warn('Unexpected response format, expected an array but got:', typeof records);
          return [];
        }
        
        return records;
      }),
      tap((records) => {
        records.forEach((record) => {
          this.stockService.notifyStockUpdate(record.IdRecord, record.Stock);
        });
      }),
      catchError(error => {
        console.error('Error in getRecords:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        console.error('Error response:', error.error);
        return throwError(() => error);
      })
    );
  }

  addRecord(record: IRecord): Observable<IRecord> {
    const headers = this.getHeaders();
    const formData = new FormData();
    
    // Append fields with correct casing and naming as expected by the backend
    formData.append("TitleRecord", record.TitleRecord);
    
    if (record.YearOfPublication !== null) {
      formData.append("YearOfPublication", record.YearOfPublication.toString());
    } else {
      formData.append("YearOfPublication", "");
    }
    
    // Handle photo upload if a new photo was selected
    if (record.Photo) {
      formData.append("Photo", record.Photo, record.Photo.name || 'record-photo');
    }
    
    // Always include PhotoName, even if it's an empty string
    // This ensures the backend knows to clear the image if needed
    formData.append("PhotoName", record.PhotoName || '');
    
    formData.append("Price", record.Price.toString());
    formData.append("Stock", record.stock.toString());
    formData.append("Discontinued", record.Discontinued.toString());
    
    // Only append GroupId if it exists
    if (record.GroupId) {
      formData.append("GroupId", record.GroupId.toString());
    }

    // Create a new promise-based function to handle the request
    return new Observable<IRecord>(subscriber => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.urlAPI}records`, true);
      
      // Set headers
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      
      xhr.onload = () => {
        try {
          
          let responseData;
          try {
            responseData = JSON.parse(xhr.responseText);
          } catch (e) {
            // If we can't parse as JSON, use the raw response
            responseData = xhr.responseText;
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            subscriber.next(responseData);
            subscriber.complete();
          } else {
            const error = new Error(xhr.statusText) as any;
            error.status = xhr.status;
            error.response = responseData;
            subscriber.error(error);
          }
        } catch (e) {
          subscriber.error(e);
        }
      };
      
      xhr.onerror = () => {
        subscriber.error(new Error('Network error'));
      };
      
      xhr.send(formData);
      
      // Cleanup function
      return () => xhr.abort();
    });
  }

  updateRecord(record: IRecord): Observable<IRecord> {
    
    // Get token from sessionStorage (where login stores it) or fall back to localStorage
    let token = sessionStorage.getItem('token') || localStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token found in sessionStorage or localStorage');
      return throwError(() => new Error('Authentication required - Please log in again'));
    }
    
    // Create headers with the token
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
      // Let the browser set the Content-Type with the correct boundary for FormData
    });
    
    const formData = new FormData();
    
    // Add all record properties to FormData
    (Object.keys(record) as Array<keyof IRecord>).forEach(key => {
      const value = record[key];
      // Skip the Photo property if it's a File object (handled separately)
      if (key === 'Photo' && value instanceof File) {
        console.log('Skipping File object in FormData, will be added separately');
        return;
      }
      // Skip functions and undefined values
      if (typeof value !== 'function' && value !== undefined && value !== null) {
        // Convert boolean values to strings
        const formValue = typeof value === 'boolean' ? String(value) : value;
        formData.append(key as string, formValue as string | Blob);
      }
    });
    
    // Handle file upload if a new photo was selected
    if (record.Photo) {
      formData.append("Photo", record.Photo, record.PhotoName || 'record-photo');
    }
    
    // Always include PhotoName, even if it's an empty string
    // This ensures the backend knows to clear the image if needed
    formData.append("PhotoName", record.PhotoName || '');

    // Log form data keys for debugging
    const formDataKeys: string[] = [];
    try {
      // @ts-ignore - entries() exists on FormData in modern browsers
      if (formData.entries) {
        // @ts-ignore
        for (const pair of formData.entries()) {
          formDataKeys.push(`${pair[0]}: ${pair[1] instanceof File ? 'File' : pair[1]}`);
        }
      }
    } catch (e) {
      console.warn('Could not log FormData entries:', e);
    }

    return this.http.put<IRecord>(`${this.urlAPI}records/${record.IdRecord}`, formData, { 
      headers,
      observe: 'response', // Get full response including status and headers
      withCredentials: true // Include credentials if needed
    }).pipe(
      map(response => response.body as IRecord), // Extract the response body
      catchError((error: any) => {
        
        // Extract and log validation errors if they exist
        if (error.error && typeof error.error === 'object') {
          const validationErrors = [];
          for (const key in error.error) {
            if (error.error.hasOwnProperty(key)) {
              validationErrors.push(`${key}: ${error.error[key]}`);
            }
          }
          if (validationErrors.length > 0) {
            console.error('Validation errors:', validationErrors);
          }
        }
        
        return throwError(() => ({
          status: error.status,
          message: error.error?.message || error.message,
          errors: error.error?.errors || null
        }));
      })
    );
  }

  deleteRecord(id: number): Observable<IRecord> {
    
    // Get token from sessionStorage or localStorage
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    
    if (!token) {
      const error = new Error('No authentication token found') as any;
      console.error('Authentication error:', error);
      return throwError(() => error);
    }

    return new Observable<IRecord>(subscriber => {
      const xhr = new XMLHttpRequest();
      xhr.open('DELETE', `${this.urlAPI}records/${id}`, true);
      
      // Set headers
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      xhr.onload = () => {
        try {
          
          let responseData;
          try {
            responseData = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch (e) {
            responseData = xhr.responseText;
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            // Successful deletion
            subscriber.next(responseData || { success: true });
            subscriber.complete();
          } else {
            const error = new Error(xhr.statusText || 'Error deleting record') as any;
            error.status = xhr.status;
            error.response = responseData;
            console.error('Delete error:', error);
            subscriber.error(error);
          }
        } catch (e) {
          console.error('Error processing delete response:', e);
          subscriber.error(e);
        }
      };
      
      xhr.onerror = () => {
        const error = new Error('Network error during delete operation');
        console.error('Network error during delete:', error);
        subscriber.error(error);
      };
      
      xhr.send();
      
      // Cleanup function
      return () => xhr.abort();
    });
  }

  getRecordsByGroup(idGroup: string | number): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.urlAPI}groups/${idGroup}`, { headers })
      .pipe(
        map((response) => {
          
          if (!response.success || !response.data) {
            console.warn('Invalid response format or no data:', response);
            return [];
          }

          const groupData = response.data;
          const records = groupData.Records || [];
          const groupName = groupData.NameGroup || '';

          if (!Array.isArray(records)) {
            console.warn('Records is not an array:', records);
            return [];
          }

          // Map the records to the expected format
          return records.map((record: any) => ({
            IdRecord: record.IdRecord,
            TitleRecord: record.TitleRecord,
            YearOfPublication: record.YearOfPublication,
            Price: parseFloat(record.Price) || 0,
            stock: record.Stock || 0,
            Discontinued: record.Discontinued || false,
            GroupId: record.GroupId || groupData.IdGroup,
            GroupName: groupName,
            ImageRecord: record.ImageRecord || '',
            Photo: record.ImageRecord || null,
            PhotoName: record.ImageRecord ? record.ImageRecord.split('/').pop() || null : null,
          } as IRecord));
        }),
        tap((records) => {
          records.forEach((record) => {
            if (record && record.IdRecord && record.stock !== undefined) {
              this.stockService.notifyStockUpdate(
                record.IdRecord,
                record.stock
              );
            }
          });
        })
      );
  }

  decrementStock(idRecord: number): Observable<any> {
    const headers = this.getHeaders();
    const amount = -1;
    return this.http
      .put(
        `${this.urlAPI}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          this.stockService.notifyStockUpdate(idRecord, amount);
        })
      );
  }

  incrementStock(idRecord: number): Observable<any> {
    const headers = this.getHeaders();
    const amount = 1;
    return this.http
      .put(
        `${this.urlAPI}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          this.stockService.notifyStockUpdate(idRecord, amount);
        })
      );
  }

  getRecordById(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    return this.http
      .get<IRecord>(`${this.urlAPI}records/${id}`, { headers })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  private getHeaders(): HttpHeaders {
    // First try to get the sessionStorage token
    let token = sessionStorage.getItem('token');
    
    // If not in sessionStorage, try localStorage
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    // If no token, return headers without authentication
    if (!token) {
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    
    // If there is a token, include it in the headers
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}
