import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons,
  IonLabel, IonIcon, IonPopover, IonContent,
  IonList, IonItem, PopoverController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { logOutOutline, documentTextOutline } from 'ionicons/icons';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonLabel, IonIcon, IonPopover,
    IonContent, IonList, IonItem
  ]
})
export class HeaderComponent implements OnInit {
  nombreUsuario: string = '';
  iniciales: string = '';

  constructor(private router: Router, private popoverController: PopoverController) {
    addIcons({ logOutOutline, documentTextOutline });
  }

  ngOnInit() {
    const conductor = JSON.parse(localStorage.getItem('conductor') || '{}');
    this.nombreUsuario = conductor.nombre || 'Usuario';
    this.generarIniciales(this.nombreUsuario);
  }

  generarIniciales(nombre: string) {
    this.iniciales = nombre
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  async logout() {
    // Cerramos el menú desplegable primero
    await this.popoverController.dismiss();

    localStorage.removeItem('conductor');
    this.router.navigate(['/login']);
  }
  async irAReporte() {
    // Cerramos el menú desplegable
    await this.popoverController.dismiss();

    console.log('Ir a reporte');
    // Si quieres que refresque la página o algo, puedes ponerlo aquí
  }
}
