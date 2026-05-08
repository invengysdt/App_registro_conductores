import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonInput, IonSpinner } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConductoresService } from '../services/conductores.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonInput, IonSpinner, FormsModule, CommonModule],
})
export class LoginPage {

  usuario = '';
  password = '';

  loading = false;
  error = false;


  constructor(private router: Router, private conductoresService: ConductoresService) { }

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
    this.loading = true;
    this.conductoresService.login(this.usuario, this.password).subscribe({
      next: (res: any) => {
        localStorage.setItem('conductor', JSON.stringify(res)); // Guardamos ID y estado
        this.router.navigateByUrl('/home');
        this.loading = false;
      },
      error: (err) => {
        this.error = true;
        this.loading = false;
        alert('Error: ' + (err.error?.error || 'No se pudo conectar'));
      }
    });
  }
}