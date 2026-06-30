import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonInput, IonSpinner, IonItem, IonLabel, LoadingController } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConductoresService } from '../services/conductores.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent,
    IonButton,
    IonInput,
    IonSpinner,
    FormsModule,
    CommonModule],
})
export class LoginPage {

  usuario = '';
  password = '';

  loading = false;
  error = false;


  constructor(private router: Router, private conductoresService: ConductoresService, private loadingCtrl: LoadingController) { }

  ngAfterViewInit() {
    if ((window as any).tsParticles) {
      this.initParticles();
      return;
    }

    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/tsparticles@2/tsparticles.bundle.min.js";
    script.onload = () => this.initParticles();

    document.body.appendChild(script);
  }

  initParticles() {
    // @ts-ignore
    tsParticles.load("particles-js", {
      particles: {
        number: { value: 40 },
        color: { value: "#00e5ff" },
        links: { enable: true, color: "#00e5ff" },
        move: { enable: true, speed: 1 }
      }
    });
  }

  async login() {
    const loading = await this.loadingCtrl.create({
      message: 'Iniciando sesión... por favor espere',
      spinner: 'crescent'
    });
    await loading.present();
    this.conductoresService.login(this.usuario, this.password).subscribe({
      next: (res: any) => {
        loading.dismiss(); // <-- Quitar el cargador si sale bien
        localStorage.setItem('conductor', JSON.stringify(res));
        this.router.navigate(['/home']);
      },
      error: (err) => {
        loading.dismiss(); // <-- Quitar el cargador si sale mal
        alert('Error: ' + (err.error?.error || 'Usuario o contraseña incorrectos'));
      }
    });
  }
}