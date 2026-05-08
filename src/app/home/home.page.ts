import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { pinOutline, refreshOutline, cameraOutline, cloudUploadOutline, exitOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ConductoresService } from '../services/conductores.service';

// Ionic standalone
import {
  IonContent, IonButton, IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonIcon,
  IonLabel,
  IonItem
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';

declare var L: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardContent,
    IonIcon,
    IonLabel,
    IonItem
  ]
})
export class HomePage {

  lat: number | null = null;
  lng: number | null = null;
  foto: string | null = null;
  map: any;
  timeGps: number | null = null;
  timeFoto: number | null = null;
  enRuta: boolean = false;
  idRegistroActual: number | null = null;




  // 🔥 control estricto
  fotoTomada = false;

  constructor(private conductoresService: ConductoresService) {
    // REGISTRAMOS LOS ICONOS
    addIcons({ pinOutline, refreshOutline, cameraOutline, cloudUploadOutline, exitOutline });
  }
  // ESTO HACE QUE BUSQUE EL GPS APENAS ABRA LA APP
  async ngOnInit() {
    this.obtenerUbicacion();
  }

  // 📍 UBICACIÓN
  async obtenerUbicacion() {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000 // Aumentamos a 15s por si el GPS está lento
      });

      this.lat = position.coords.latitude;
      this.lng = position.coords.longitude;
      this.timeGps = Date.now();
      this.timeFoto = null;

      // Inicializar o actualizar el mapa
      if (!this.map) {
        this.map = L.map('map').setView([this.lat, this.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
      } else {
        this.map.setView([this.lat, this.lng], 15);
      }

      // Limpiar marcadores anteriores y poner uno nuevo
      this.map.eachLayer((layer: any) => { if (layer instanceof L.Marker) this.map.removeLayer(layer); });
      L.marker([this.lat, this.lng]).addTo(this.map);

    } catch (error) {
      console.error('Error GPS:', error);
      alert('No se pudo obtener la ubicación. Asegúrate de tener el GPS encendido y estar en un lugar despejado.');
    }
  }


  // 📸 FOTO SOLO CÁMARA
  async tomarFoto() {
    if (!this.timeGps) {
      alert('Primero debes obtener la ubicación');
      return;
    }

    const ahora = Date.now();
    const diferencia = (ahora - this.timeGps) / 1000; // Segundos transcurridos

    if (diferencia > 45) {
      alert('Han pasado más de 45 segundos desde el GPS. Debes actualizar tu ubicación.');
      this.lat = null;
      this.lng = null;
      this.timeGps = null;
      return;
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      this.foto = image.dataUrl || null;
      this.fotoTomada = true;
      this.timeFoto = Date.now(); // Guardamos la hora de la foto
    } catch (error) {
      console.log('Usuario canceló');
    }
  }

  enviarReporte() {
    // --- RESTAURAR VALIDACIÓN DE 45s ---
    if (!this.timeFoto) return;
    const ahora = Date.now();
    const diferencia = (ahora - this.timeFoto) / 1000;

    if (diferencia > 45) {
      alert('Tiempo excedido para enviar el reporte (máx 45s). Empieza de nuevo.');
      this.resetearFormulario();
      return;
    }
    // -----------------------------------

    const conductor = JSON.parse(localStorage.getItem('conductor') || '{}');

    const payload = {
      conductor_id: conductor.id,
      id: this.idRegistroActual,
      foto_ingreso: this.foto,
      foto_salida: this.foto,
      gps_ingreso: { lat: this.lat, lng: this.lng },
      gps_salida: { lat: this.lat, lng: this.lng }
    };

    if (!this.enRuta) {
      this.conductoresService.registrarIngreso(payload).subscribe((res: any) => {
        this.idRegistroActual = res.id;
        this.enRuta = true;
        alert('¡Ingreso registrado correctamente en la base de datos!');
        this.resetearFormulario();
      });
    } else {
      this.conductoresService.registrarSalida(payload).subscribe(() => {
        this.enRuta = false;
        alert('¡Salida registrada correctamente! Feliz descanso.');
        this.resetearFormulario();
      });
    }
  }


  // Crea esta función auxiliar para no repetir código de limpieza
  resetearFormulario() {
    this.lat = null;
    this.lng = null;
    this.foto = null;
    this.timeGps = null;
    this.timeFoto = null;
    this.fotoTomada = false;
  }




  // 🔒 VALIDACIÓN
  get puedeGuardar(): boolean {
    return !!(this.lat && this.lng && this.foto && this.fotoTomada);
  }

}