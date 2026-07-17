import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class ConductoresService {
    constructor(private http: HttpClient) { }

    private getHttpOptions() {
        return {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        };
    }

    login(usuario: string, contrasena: string) {
        return this.http.post(`${environment.apiUrl}/conductores/login`, { usuario, contraseña: contrasena }, this.getHttpOptions()).pipe(
            retry({
                count: 2,
                delay: (error, retryCount) => {
                    if (error.status === 0) {
                        console.warn(`[Network] Reintentando login (${retryCount}/2) debido a falla de red...`);
                        return timer(2000 * retryCount);
                    }
                    return throwError(() => error);
                }
            })
        );
    }

    // Solicita el reto biométrico al servidor de Node
    obtenerRetoLiveness(): Observable<any> {
        return this.http.get(`${environment.apiUrl}/registro/solicitar-reto`, this.getHttpOptions()).pipe(
            retry({
                count: 2,
                delay: (error, retryCount) => {
                    if (error.status === 0) {
                        console.warn(`[Network] Reintentando obtener reto (${retryCount}/2) debido a falla de red...`);
                        return timer(1500 * retryCount);
                    }
                    return throwError(() => error);
                }
            })
        );
    }

    // Envía el FormData con las imágenes y los datos del viaje (Ingreso)
    registrarIngreso(formData: FormData) {
        return this.http.post(`${environment.apiUrl}/registro/ingreso`, formData, this.getHttpOptions()).pipe(
            retry({
                count: 2,
                delay: (error, retryCount) => {
                    if (error.status === 0) {
                        console.warn(`[Network] Reintentando registrar ingreso (${retryCount}/2) debido a falla de red...`);
                        return timer(3000 * retryCount); // Más tiempo de espera para reintentar uploads pesados (3s, 6s)
                    }
                    return throwError(() => error);
                }
            })
        );
    }

    // Envía el FormData con las imágenes y los datos del viaje (Salida)
    registrarSalida(formData: FormData) {
        return this.http.post(`${environment.apiUrl}/registro/salida`, formData, this.getHttpOptions()).pipe(
            retry({
                count: 2,
                delay: (error, retryCount) => {
                    if (error.status === 0) {
                        console.warn(`[Network] Reintentando registrar salida (${retryCount}/2) debido a falla de red...`);
                        return timer(3000 * retryCount); // Más tiempo de espera para reintentar (3s, 6s)
                    }
                    return throwError(() => error);
                }
            })
        );
    }

    enrolarInicial(formData: FormData) {
        return this.http.post(`${environment.apiUrl}/registro/enrolar-inicial`, formData, this.getHttpOptions());
    }
}