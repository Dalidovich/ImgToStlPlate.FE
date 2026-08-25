import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class ConvertService {
  private apiUrl = '/api/convert';

  constructor(private http: HttpClient) {}

  toBw(
    image: File,
    selection: CropSelection,
    orientation: string,
    fillSpace: boolean,
    invert: boolean,
    angle: number = 0
  ): Observable<Blob> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('selection', JSON.stringify(selection));
    formData.append('orientation', orientation);
    formData.append('fillSpace', fillSpace.toString());
    formData.append('invert', invert.toString());
    formData.append('rotationDegrees', angle.toString());
    return this.http.post(`${this.apiUrl}/to-bw`, formData, { responseType: 'blob' });
  }

  denoise(bwImage: Blob, intensity: number): Observable<Blob> {
    const formData = new FormData();
    formData.append('bwImage', bwImage, 'bw.png');
    formData.append('intensity', intensity.toString());
    return this.http.post(`${this.apiUrl}/denoise`, formData, { responseType: 'blob' });
  }

  toStl(bwImage: Blob, thickness: number, modelWidth: number, modelHeight: number, orientation: string): Observable<Blob> {
    const formData = new FormData();
    formData.append('bwImage', bwImage, 'bw.png');
    formData.append('thickness', thickness.toString());
    formData.append('modelWidth', modelWidth.toString());
    formData.append('modelHeight', modelHeight.toString());
    formData.append('orientation', orientation);
    return this.http.post(`${this.apiUrl}/to-stl`, formData, { responseType: 'blob' });
  }
}
