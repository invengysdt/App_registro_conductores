import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ConductoresService {
    constructor(private http: HttpClient) { }

    login(usuario: string, contraseña: string) {
        return this.http.post(`${environment.apiUrl}/conductores/login`, { usuario, contraseña });
    }

    registrarIngreso(datos: any) {
        return this.http.post(`${environment.apiUrl}/registro/ingreso`, datos);
    }

    registrarSalida(datos: any) {
        return this.http.post(`${environment.apiUrl}/registro/salida`, datos);
    }
}
