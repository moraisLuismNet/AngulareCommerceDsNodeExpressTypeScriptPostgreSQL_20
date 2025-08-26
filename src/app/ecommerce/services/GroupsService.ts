import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { IGroup } from '../EcommerceInterface';

@Injectable({
  providedIn: 'root',
})
export class GroupsService {
  urlAPI = environment.urlAPI;
  constructor(private http: HttpClient, private authGuard: AuthGuard) {}

  getGroups(): Observable<IGroup[]> {
    const headers = this.getHeaders();
    
    return this.http
      .get<any>(`${this.urlAPI}groups`, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error in the request:', error);
          if (error.error) {
            console.error('Error details:', error.error);
          }
          return throwError(() => error);
        }),
        map((response: { success: boolean; data: any[] }) => {
          if (response?.success && response?.data && Array.isArray(response.data)) {
            // Map the server data to the expected frontend format
            return response.data.map((group: any) => {
              // Handle image URL construction
              let imageUrl = group.ImageGroup || '';
              
              // If image path is not empty and not already a full URL
              if (imageUrl && !imageUrl.startsWith('http')) {
                // Remove leading slash if present
                const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
                
                // If the path doesn't already include 'assets', prepend it
                if (!cleanPath.includes('assets/')) {
                  imageUrl = `assets/img/${cleanPath}`;
                } else {
                  imageUrl = cleanPath;
                }
                
                // Log the constructed path for debugging
                console.log(`Constructed image path for group ${group.IdGroup}:`, imageUrl);
              }

              return {
                IdGroup: group.IdGroup,
                NameGroup: group.NameGroup,
                ImageGroup: imageUrl,
                Photo: null,
                PhotoName: group.ImageGroup ? group.ImageGroup.split('/').pop() || null : null,
                MusicGenreId: group.MusicGenreId,
                MusicGenreName: group.NameMusicGenre || 'Genderless',
                MusicGenre: group.NameMusicGenre || 'Genderless',
                totalRecords: group.TotalRecords || 0
              } as IGroup;
            });
          }
          return [];
        }),
        catchError(error => {
          console.error('Error in getGroups:', error);
          if (error.error) {
            console.error('Error details:', error.error);
          }
          return throwError(() => error);
        })
      );
  }

  addGroup(group: IGroup): Observable<IGroup> {
    const headers = this.getHeaders();
    const formData = new FormData();
    
    // Ensure all required fields are included
    if (!group.NameGroup || group.MusicGenreId === undefined) {
      const error = new Error('Missing required fields: ' + 
        (!group.NameGroup ? 'NameGroup, ' : '') +
        (group.MusicGenreId === undefined ? 'MusicGenreId' : '')
      );
      console.error('Validation error:', error.message);
      return new Observable(subscriber => {
        subscriber.error(error);
      });
    }
    
    console.log('Adding group with data:', {
      NameGroup: group.NameGroup,
      MusicGenreId: group.MusicGenreId,
      hasPhoto: !!group.Photo
    });
    
    // Append all required fields with the exact names expected by the server
    formData.append('NameGroup', group.NameGroup);
    formData.append('MusicGenreId', group.MusicGenreId.toString());
    
    // Only append photo if it exists
    if (group.Photo) {
      formData.append('Photo', group.Photo);
    }

    return this.http.post<IGroup>(`${this.urlAPI}groups`, formData, {
      headers,
      observe: 'response'
    }).pipe(
      map(response => {
        return response.body || group;
      }),
      catchError(error => {
        console.error('Add error:', error);
        if (error.error) {
          console.error('Error details:', error.error);
        }
        return throwError(() => error);
      })
    );
  }

  updateGroup(group: IGroup): Observable<IGroup> {
    const headers = this.getHeaders();
    const formData = new FormData();
    
    // Ensure all required fields are included
    if (!group.IdGroup || !group.NameGroup || group.MusicGenreId === undefined) {
      const error = new Error('Missing required fields: ' + 
        (!group.IdGroup ? 'IdGroup, ' : '') +
        (!group.NameGroup ? 'NameGroup, ' : '') +
        (group.MusicGenreId === undefined ? 'MusicGenreId' : '')
      );
      console.error('Validation error:', error.message);
      return new Observable(subscriber => {
        subscriber.error(error);
      });
    }
    
    // Append all required fields with the exact names expected by the server
    formData.append('IdGroup', group.IdGroup.toString());
    formData.append('NameGroup', group.NameGroup);
    formData.append('MusicGenreId', group.MusicGenreId.toString());
    
    // Only append photo if it exists
    if (group.Photo) {
      formData.append('photo', group.Photo);
    }

    return new Observable<IGroup>(subscriber => {
      this.http.put<IGroup>(
        `${this.urlAPI}groups/${group.IdGroup}`,
        formData,
        { 
          headers: headers,
          observe: 'response'
        }
      ).subscribe({
        next: (response) => {
          if (response.body) {
            subscriber.next(response.body);
          } else {
            subscriber.next(group); // Return the original group if no response body
          }
          subscriber.complete();
        },
        error: (error) => {
          console.error('Update error:', error);
          if (error.error) {
            console.error('Error details:', error.error);
          }
          subscriber.error(error);
        }
      });
    });
  }

  deleteGroup(id: number): Observable<IGroup> {
    const headers = this.getHeaders();
    return this.http.delete<IGroup>(`${this.urlAPI}groups/${id}`, {
      headers,
    });
  }

  getGroupName(idGroup: string | number): Observable<string> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.urlAPI}groups/${idGroup}`, { headers })
      .pipe(
        map((response) => {
          
          // Handle direct group object
          if (
            response &&
            typeof response === 'object' &&
            'nameGroup' in response
          ) {
            return response.nameGroup;
          }

          // Handle $values wrapper
          if (
            response &&
            response.$values &&
            typeof response.$values === 'object'
          ) {
            if (
              Array.isArray(response.$values) &&
              response.$values.length > 0
            ) {
              return response.$values[0].nameGroup || '';
            }
            if ('nameGroup' in response.$values) {
              return response.$values.nameGroup;
            }
          }

          return '';
        })
      );
  }

  getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return headers;
  }
}
