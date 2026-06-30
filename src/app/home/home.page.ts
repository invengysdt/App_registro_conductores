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

  // Propiedades nuevas para la biometría
  mostrarCamaraBiometrica = false;
  retoActivo = '';
  instruccionReto = '';
  countdownBiometrico = '';
  progresoLiveness = 0;
  streamVideo: MediaStream | null = null;




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
    this.verificarBiometriaInicial();
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
    // 1. Validaciones básicas
    if (!this.lat || !this.lng) {
      alert('Se requiere la ubicación GPS.');
      return;
    }

    const conductor = JSON.parse(localStorage.getItem('conductor') || '{}');
    const cedula = conductor.numero_documento;

    if (!cedula) {
      alert('No se encontró el documento del conductor.');
      return;
    }

    // 2. Mostrar cargador inicial
    const loading = await this.loadingCtrl.create({
      message: 'Solicitando reto biométrico...',
      spinner: 'crescent'
    });
    await loading.present();

    // 3. Solicitar el reto a Node.js
    this.conductoresService.obtenerRetoLiveness().subscribe({
      next: async (resReto) => {
        loading.dismiss();
        this.retoActivo = resReto.reto;
        this.instruccionReto = resReto.instruccion;

        // 4. Iniciar la webcam del WebView
        try {
          this.streamVideo = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 }
          });
          this.mostrarCamaraBiometrica = true;

          // Asignar el stream al elemento <video>
          setTimeout(() => {
            const videoEl = document.getElementById('webcamVideo') as HTMLVideoElement;
            if (videoEl) videoEl.srcObject = this.streamVideo;
          }, 200);

          await new Promise(resolve => setTimeout(resolve, 1000));
          const videoParaSelfie = document.getElementById('webcamVideo') as HTMLVideoElement;
          const canvasSelfie = document.createElement('canvas');
          canvasSelfie.width = 640;
          canvasSelfie.height = 480;
          const ctxSelfie = canvasSelfie.getContext('2d')!;
          ctxSelfie.drawImage(videoParaSelfie, 0, 0, 640, 480);
          const selfieBlob = await new Promise<Blob>(resolve => {
            canvasSelfie.toBlob(b => resolve(b!), 'image/jpeg', 0.92);
          });

          // 5. Cuenta regresiva de 3 segundos para que el usuario se prepare
          for (let i = 3; i >= 1; i--) {
            this.countdownBiometrico = i + '...';
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          this.countdownBiometrico = '¡YA!';

          // 6. Capturar la ráfaga de frames durante el reto
          const framesBlobs = await this.capturarFramesDeVideo(3000, 100); // Captura por 1.5s cada 80ms

          // Cerrar la cámara
          this.cerrarCamaraWeb();

          // 7. Mostrar cargador para enviar al servidor
          const sendingLoader = await this.loadingCtrl.create({
            message: 'Verificando identidad y registrando jornada...',
            spinner: 'crescent'
          });
          await sendingLoader.present();

          // 8. Construir FormData
          const formData = new FormData();
          formData.append('conductor_id', conductor.id);
          formData.append('cedula', cedula);
          formData.append('reto', this.retoActivo);

          // Foto de rostro principal (usamos el frame del medio de la ráfaga)
          formData.append('foto_rostro', selfieBlob, 'rostro.jpg');

          // Adjuntar los frames individuales para el Liveness
          framesBlobs.forEach((blob, idx) => {
            formData.append('frames', blob, `frame_${idx}.jpg`);
          });

          // Si tienes la foto del tacómetro, adjúntala (opcional)
          if (this.foto2) {
            const tacoBlob = await this.convertirBase64ABlob(this.foto2);
            formData.append('foto_tacometro', tacoBlob, 'tacometro.jpg');
          }

          // Adjuntar GPS según si es Ingreso o Salida
          if (!this.enRuta) {
            formData.append('gps_ingreso', JSON.stringify({ lat: this.lat, lng: this.lng }));

            // Llamar a Ingreso
            this.conductoresService.registrarIngreso(formData).subscribe({
              next: (res: any) => {
                sendingLoader.dismiss();
                this.idRegistroActual = res.id;
                this.enRuta = true;
                conductor.enRuta = true;
                conductor.idRegistroActual = res.id;
                conductor.biometria_activa = true;
                localStorage.setItem('conductor', JSON.stringify(conductor));
                alert('¡Ingreso biométrico registrado con éxito!');
                this.resetearFormulario();
              },
              error: (err) => {
                sendingLoader.dismiss();
                alert('Error biométrico: ' + (err.error?.detalles || err.error?.error || 'No coincide tu rostro.'));
              }
            });
          } else {
            formData.append('id', String(this.idRegistroActual));
            formData.append('gps_salida', JSON.stringify({ lat: this.lat, lng: this.lng }));

            // Llamar a Salida
            this.conductoresService.registrarSalida(formData).subscribe({
              next: () => {
                sendingLoader.dismiss();
                this.enRuta = false;
                this.idRegistroActual = null;
                conductor.enRuta = false;
                conductor.idRegistroActual = null;
                conductor.biometria_activa = true;
                localStorage.setItem('conductor', JSON.stringify(conductor));
                alert('¡Salida biométrica registrada con éxito!');
                this.resetearFormulario();
              },
              error: (err) => {
                sendingLoader.dismiss();
                alert('Error biométrico: ' + (err.error?.detalles || err.error?.error || 'No coincide tu rostro.'));
              }
            });
          }

        } catch (error) {
          loading.dismiss();
          this.cerrarCamaraWeb();
          alert('Error al acceder a la cámara frontal: ' + error);
        }
      },
      error: () => {
        loading.dismiss();
        alert('Error al obtener el reto dinámico del servidor.');
      }
    });
  }

  // Función para capturar frames continuamente
  async capturarFramesDeVideo(duracionMs: number, intervaloMs: number): Promise<Blob[]> {
    const video = document.getElementById('webcamVideo') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const blobs: Blob[] = [];
    const inicio = Date.now();
    let transcurrido = 0;

    while (transcurrido < duracionMs) {
      if (video && ctx) {
        // Dibujamos con efecto espejo desactivado (tal como lo espera Python)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.80);
        });
        blobs.push(blob);
      }

      transcurrido = Date.now() - inicio;
      this.progresoLiveness = Math.min(100, (transcurrido / duracionMs) * 100);
      await new Promise(resolve => setTimeout(resolve, intervaloMs));
      transcurrido = Date.now() - inicio;
    }
    return blobs;
  }

  // Apaga la cámara y esconde el overlay
  cerrarCamaraWeb() {
    this.mostrarCamaraBiometrica = false;
    this.countdownBiometrico = '';
    this.progresoLiveness = 0;
    if (this.streamVideo) {
      this.streamVideo.getTracks().forEach(track => track.stop());
      this.streamVideo = null;
    }
  }

  // Convierte fotos tomadas previamente (ej. tacómetro) a Blob
  async convertirBase64ABlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return await response.blob();
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
    return !!(this.lat && this.lng); // El botón se habilitará apenas obtenga el GPS
  }


  verificarBiometriaInicial() {
    const datos = localStorage.getItem('conductor');
    if (datos) {
      const conductor = JSON.parse(datos);
      // Si no tiene biometría activa, abrimos la cámara automáticamente
      if (!conductor.biometria_activa) {
        setTimeout(() => {
          alert('Registro facial inicial: Para tu seguridad, procederemos a registrar tu rostro por primera vez.');
          this.abrirCamaraEnrolamientoInicial();
        }, 1000);
      }
    }
  }

  async abrirCamaraEnrolamientoInicial() {
    try {
      alert('Registro facial inicial: Mira de frente a la cámara con buena luz. La foto se tomará automáticamente en 2 segundos.');

      // Abrimos WebRTC — MISMO método que la verificación
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });

      // Video temporal oculto para capturar el frame
      const videoEl = document.createElement('video');
      videoEl.srcObject = stream;
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
      document.body.appendChild(videoEl);

      // Esperamos 2 segundos para que la cámara se estabilice con luz correcta
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capturamos el frame SIN espejo — igual que en verificación
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(videoEl, 0, 0, 640, 480);

      // Detenemos la cámara y limpiamos el elemento
      stream.getTracks().forEach(track => track.stop());
      document.body.removeChild(videoEl);

      // Convertimos a Blob JPEG con la misma calidad que verificación
      const fotoBlob = await new Promise<Blob>(resolve => {
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.92);
      });

      // Enviamos al endpoint de enrolamiento
      const loading = await this.loadingCtrl.create({
        message: 'Registrando rostro en la base de datos...',
        spinner: 'crescent'
      });
      await loading.present();

      const conductor = JSON.parse(localStorage.getItem('conductor') || '{}');
      const cedula = conductor.numero_documento;

      const formData = new FormData();
      formData.append('cedula', cedula);
      formData.append('foto_rostro', fotoBlob, 'rostro.jpg');

      this.conductoresService.enrolarInicial(formData).subscribe({
        next: () => {
          loading.dismiss();
          conductor.biometria_activa = true;
          localStorage.setItem('conductor', JSON.stringify(conductor));
          alert('¡Registro facial inicial completado con éxito! Ahora puedes usar la aplicación de forma normal.');
        },
        error: (err) => {
          loading.dismiss();
          const msgError = err.error?.detalles?.mensaje || err.error?.error || err.error?.mensaje || err.message || 'Error de conexión';
          alert('Error en registro inicial: ' + msgError);
          this.abrirCamaraEnrolamientoInicial();
        }
      });

    } catch (error) {
      console.log('Error en enrolamiento:', error);
      alert('Debes registrar tu rostro para poder utilizar la aplicación.');
      this.abrirCamaraEnrolamientoInicial();
    }
  }
}