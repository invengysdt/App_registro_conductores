import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ConductoresService {
    constructor(private http: HttpClient) { }

    login(usuario: string, contrasena: string) {
        return this.http.post(`${environment.apiUrl}/conductores/login`, { usuario, contraseña: contrasena });
    }

    // Solicita el reto biométrico al servidor de Node
    obtenerRetoLiveness(): Observable<any> {
        return this.http.get(`${environment.apiUrl}/registro/solicitar-reto`);
    }

    // Envía el FormData con las imágenes y los datos del viaje (Ingreso)
    registrarIngreso(formData: FormData) {
        return this.http.post(`${environment.apiUrl}/registro/ingreso`, formData);
    }

    // Envía el FormData con las imágenes y los datos del viaje (Salida)
    registrarSalida(formData: FormData) {
        return this.http.post(`${environment.apiUrl}/registro/salida`, formData);
    }

    enrolarInicial(formData: FormData) {
        return this.http.post(`${environment.apiUrl}/registro/enrolar-inicial`, formData);
    }
}