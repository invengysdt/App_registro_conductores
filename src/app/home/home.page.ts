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
  IonItem,
  LoadingController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../shared/components/header/header.component';

declare var L: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    CommonModule,
    IonCard,
    IonCardContent,
    IonIcon,
    IonLabel,
    IonItem,
    HeaderComponent
  ]
})
export class HomePage {

  lat: number | null = null;
  lng: number | null = null;
  foto: string | null = null;
  foto2: string | null = null;
  foto2Tomada = false;
  map: any;
  timeGps: number | null = null;
  timeFoto: number | null = null;
  enRuta: boolean = false;
  idRegistroActual: number | null = null;




  // 🔥 control estricto
  fotoTomada = false;

  constructor(private conductoresService: ConductoresService, private loadingCtrl: LoadingController) {
    // REGISTRAMOS LOS ICONOS
    addIcons({ pinOutline, refreshOutline, cameraOutline, cloudUploadOutline, exitOutline });
  }
  // ESTO HACE QUE BUSQUE EL GPS APENAS ABRA LA APP
  async ngOnInit() {
    this.cargarEstadoDeRuta();
    this.obtenerUbicacion();
  }

  cargarEstadoDeRuta() {
    const datos = localStorage.getItem('conductor');
    if (datos) {
      const conductor = JSON.parse(datos);
      this.enRuta = conductor.enRuta || false;
      this.idRegistroActual = conductor.idRegistroActual || null;
    }
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

  async tomarFoto2() {
    try {
      const image = await Camera.getPhoto({
        quality: 90, // Calidad alta como pediste
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      this.foto2 = image.dataUrl || null;
      this.foto2Tomada = true;
    } catch (error) {
      console.log('Usuario canceló foto 2');
    }
  }


  async enviarReporte() {
    // 1. Validación de tiempo (45s)
    if (!this.timeFoto) return;
    const ahora = Date.now();
    const diferencia = (ahora - this.timeFoto) / 1000;
    if (diferencia > 45) {
      alert('Tiempo excedido (máx 45s desde la primera foto). Empieza de nuevo.');
      this.resetearFormulario();
      return;
    }

    // 2. Mostrar cargador (importante para fotos pesadas)
    const loading = await this.loadingCtrl.create({
      message: 'Subiendo evidencia en alta calidad...',
      spinner: 'crescent'
    });
    await loading.present();

    const conductor = JSON.parse(localStorage.getItem('conductor') || '{}');

    // 3. Preparar el paquete de datos (con las 2 fotos)
    const payload = {
      conductor_id: conductor.id,
      id: this.idRegistroActual,
      foto_ingreso: this.foto,
      foto_ingreso_2: this.foto2, // <-- Nueva
      foto_salida: this.foto,
      foto_salida_2: this.foto2,   // <-- Nueva
      gps_ingreso: { lat: this.lat, lng: this.lng },
      gps_salida: { lat: this.lat, lng: this.lng }
    };

    if (!this.enRuta) {
      this.conductoresService.registrarIngreso(payload).subscribe({
        next: (res: any) => {
          loading.dismiss();
          this.idRegistroActual = res.id;
          this.enRuta = true;

          // Actualizar storage
          conductor.enRuta = true;
          conductor.idRegistroActual = res.id;
          localStorage.setItem('conductor', JSON.stringify(conductor));

          alert('¡Ingreso registrado con éxito!');
          this.resetearFormulario();
        },
        error: () => {
          loading.dismiss();
          alert('Error al conectar con el servidor');
        }
      });
    } else {
      this.conductoresService.registrarSalida(payload).subscribe({
        next: () => {
          loading.dismiss();
          this.enRuta = false;
          this.idRegistroActual = null;

          // Actualizar storage
          conductor.enRuta = false;
          conductor.idRegistroActual = null;
          localStorage.setItem('conductor', JSON.stringify(conductor));

          alert('¡Salida registrada con éxito!');
          this.resetearFormulario();
        },
        error: () => {
          loading.dismiss();
          alert('Error al conectar con el servidor');
        }
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
    this.foto2 = null;
    this.foto2Tomada = false;
  }




  // 🔒 VALIDACIÓN
  get puedeGuardar(): boolean {
    return !!(this.lat && this.lng && this.foto && this.fotoTomada && this.foto2Tomada);
  }

}