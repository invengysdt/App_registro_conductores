import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { pinOutline, refreshOutline, cameraOutline, cloudUploadOutline, exitOutline, closeCircleOutline, camera } from 'ionicons/icons';
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
  foto2: string | null = null;
  foto2Tomada = false;
  map: any;
  timeGps: number | null = null;
  enRuta: boolean = false;
  idRegistroActual: number | null = null;

  // Propiedades nuevas para la biometría
  mostrarCamaraBiometrica = false;
  retoActivo = '';
  instruccionReto = '';
  countdownBiometrico = '';
  progresoLiveness = 0;
  streamVideo: MediaStream | null = null;
  brilloOriginal: number = 1.0;

  // Propiedades para la cámara del tacómetro
  mostrarCamaraTacometro = false;
  streamTacometro: MediaStream | null = null;

  constructor(private conductoresService: ConductoresService, private loadingCtrl: LoadingController) {
    // REGISTRAMOS LOS ICONOS
    addIcons({ pinOutline, refreshOutline, cameraOutline, cloudUploadOutline, exitOutline, closeCircleOutline, camera });
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


  // No longer needed: tomarFoto() has been removed since biometric liveness captures face automatically.

  async tomarFoto2() {
    if (!this.timeGps) {
      alert('Primero debes obtener la ubicación GPS.');
      return;
    }

    const ahora = Date.now();
    const diferencia = (ahora - this.timeGps) / 1000; // Segundos transcurridos

    if (diferencia > 45) {
      alert('Han pasado más de 45 segundos desde que obtuviste el GPS. Debes actualizar tu ubicación.');
      this.lat = null;
      this.lng = null;
      this.timeGps = null;
      return;
    }

    // Iniciar cámara trasera en vivo para el tacómetro
    try {
      this.streamTacometro = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.mostrarCamaraTacometro = true;

      setTimeout(() => {
        const videoEl = document.getElementById('tacometroVideo') as HTMLVideoElement;
        if (videoEl) videoEl.srcObject = this.streamTacometro;
      }, 250);

    } catch (error) {
      alert('Error al acceder a la cámara trasera: ' + error);
    }
  }

  cerrarCamaraTacometro() {
    this.mostrarCamaraTacometro = false;
    if (this.streamTacometro) {
      this.streamTacometro.getTracks().forEach(track => track.stop());
      this.streamTacometro = null;
    }
  }

  async capturarFotoTacometro() {
    const video = document.getElementById('tacometroVideo') as HTMLVideoElement;
    if (!video) return;

    const canvas = document.createElement('canvas');
    // Capturar a la resolución real del video para máxima definición en el OCR
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Dibujar sin efecto espejo (cámara trasera)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.foto2 = canvas.toDataURL('image/jpeg', 0.90);
      this.foto2Tomada = true;
    }
    this.cerrarCamaraTacometro();
  }


  async enviarReporte() {
    // 1. Validaciones básicas y frescura del GPS (máximo 45 segundos)
    if (!this.lat || !this.lng || !this.timeGps) {
      alert('Se requiere la ubicación GPS.');
      return;
    }

    const ahora = Date.now();
    const diferencia = (ahora - this.timeGps) / 1000;

    if (diferencia > 45) {
      alert('Han pasado más de 45 segundos desde que obtuviste el GPS. Por favor, actualiza tu ubicación antes de registrar tu ingreso/salida.');
      this.lat = null;
      this.lng = null;
      this.timeGps = null;
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

        try {
          // Guardar brillo actual y forzar brillo máximo (1.0) para iluminar el rostro
          const { ScreenBrightness } = await import('@capacitor-community/screen-brightness');
          const { brightness } = await ScreenBrightness.getBrightness();
          this.brilloOriginal = brightness;
          await ScreenBrightness.setBrightness({ brightness: 1.0 });
        } catch (e) {
          console.warn('No se pudo establecer el brillo máximo:', e);
        }

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

          // Esperar 1 segundo para asegurar la inicialización inicial
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 5. Cuenta regresiva de 3 segundos para que el usuario se prepare y mire al frente
          for (let i = 3; i >= 1; i--) {
            this.countdownBiometrico = i + '...';
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          this.countdownBiometrico = '¡YA!';

          // Capturar la selfie de frente justo ahora (cámara madura y usuario mirando al frente)
          const videoParaSelfie = document.getElementById('webcamVideo') as HTMLVideoElement;
          const canvasSelfie = document.createElement('canvas');
          canvasSelfie.width = 640;
          canvasSelfie.height = 480;
          const ctxSelfie = canvasSelfie.getContext('2d')!;
          // Espejar el lienzo para consistencia con los frames del liveness
          ctxSelfie.translate(640, 0);
          ctxSelfie.scale(-1, 1);
          ctxSelfie.drawImage(videoParaSelfie, 0, 0, 640, 480);
          const selfieBlob = await new Promise<Blob>(resolve => {
            canvasSelfie.toBlob(b => resolve(b!), 'image/jpeg', 0.92);
          });

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
                const msgError = err.error?.detalles?.mensaje || err.error?.detalles || err.error?.error || 'No coincide tu rostro.';
                alert('Error biométrico: ' + msgError);
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
                const msgError = err.error?.detalles?.mensaje || err.error?.detalles || err.error?.error || 'No coincide tu rostro.';
                alert('Error biométrico: ' + msgError);
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
        // Dibujamos con efecto espejo ACTIVADO (tal como funciona en test_camera.html y lo espera Python)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

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
  async cerrarCamaraWeb() {
    this.mostrarCamaraBiometrica = false;
    this.countdownBiometrico = '';
    this.progresoLiveness = 0;
    if (this.streamVideo) {
      this.streamVideo.getTracks().forEach(track => track.stop());
      this.streamVideo = null;
    }
    try {
      // Restaurar el brillo original del celular al cerrar
      const { ScreenBrightness } = await import('@capacitor-community/screen-brightness');
      await ScreenBrightness.setBrightness({ brightness: this.brilloOriginal });
    } catch (e) {
      console.warn('No se pudo restaurar el brillo:', e);
    }
  }

  // Convierte fotos tomadas previamente (ej. tacómetro) a Blob
  async convertirBase64ABlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return await response.blob();
  }




  // Limpieza del formulario al completar registro
  resetearFormulario() {
    this.lat = null;
    this.lng = null;
    this.timeGps = null;
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
      try {
        // Guardar brillo actual y forzar brillo máximo (1.0) para el enrolamiento inicial
        const { ScreenBrightness } = await import('@capacitor-community/screen-brightness');
        const { brightness } = await ScreenBrightness.getBrightness();
        this.brilloOriginal = brightness;
        await ScreenBrightness.setBrightness({ brightness: 1.0 });
      } catch (e) {
        console.warn('No se pudo establecer el brillo máximo:', e);
      }

      // 1. Abrimos la cámara frontal en el WebView
      this.streamVideo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });

      // 2. Activamos el overlay circular reutilizando la misma vista de verificación
      this.mostrarCamaraBiometrica = true;
      this.instruccionReto = 'Mira de frente a la cámara con buena luz.';
      this.progresoLiveness = 0;

      // 3. Asignamos el stream al elemento <video>
      setTimeout(() => {
        const videoEl = document.getElementById('webcamVideo') as HTMLVideoElement;
        if (videoEl) videoEl.srcObject = this.streamVideo;
      }, 200);

      // 4. Cuenta regresiva visual de 3 segundos
      for (let i = 3; i >= 1; i--) {
        this.countdownBiometrico = i + '...';
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      this.countdownBiometrico = '¡Listo!';

      // 5. Capturamos el frame en el canvas
      const videoParaCaptura = document.getElementById('webcamVideo') as HTMLVideoElement;
      if (!videoParaCaptura) {
        throw new Error('No se encontró el visor de la cámara.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(videoParaCaptura, 0, 0, 640, 480);

      // 6. Apagamos la cámara de inmediato y cerramos el visor
      this.cerrarCamaraWeb();

      // Convertimos el canvas a Blob JPEG de alta calidad
      const fotoBlob = await new Promise<Blob>(resolve => {
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.92);
      });

      // 7. Mostramos el cargador de registro
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
          // Permitir reintentar
          this.abrirCamaraEnrolamientoInicial();
        }
      });

    } catch (error) {
      console.log('Error en enrolamiento:', error);
      alert('Debes registrar tu rostro para poder utilizar la aplicación. Reintentando...');
      this.abrirCamaraEnrolamientoInicial();
    }
  }
}