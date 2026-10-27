import { ChangeDetectorRef, Component, inject, NgZone, OnInit } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { environment } from '../../environments/environment';

import { initializeApp } from 'firebase/app';

import {
  getFirestore,
  collection,
  getDocs,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  type Unsubscribe
} from 'firebase/firestore';

const app = initializeApp(environment.firebaseConfig);
const db = getFirestore(app);

const laundryServicesCol = collection(db, 'laundryServices');

interface LaundryService {
  id: string;
  serviceName: string;
  price: string;
  category: string;
  duration: string;
  status: string;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit {

  services: LaundryService[] = [];
  searchTerm = '';
  statusFilter = 'all';
  isEditModalOpen = false;
  editingService = {
    id: '',
    serviceName: '',
    price: '',
    category: '',
    duration: '',
    status: ''
  };
  private stopUsersListener?: Unsubscribe;

  private readonly alertCtrl = inject(AlertController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  ngOnInit() {
    this.loadUsers();
  }

  private mapService(document: { id: string; data: () => Record<string, unknown> }): LaundryService {
    const data = document.data();
    return {
      id: document.id,
      serviceName: String(data['serviceName'] ?? ''),
      price: String(data['price'] ?? ''),
      category: String(data['category'] ?? ''),
      duration: String(data['duration'] ?? ''),
      status: String(data['status'] ?? '')
    };
  }

  async loadUsers() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading services...'
    });
    await loading.present();

    try {
      const snapshot = await getDocs(laundryServicesCol);
      this.zone.run(() => {
        this.services = snapshot.docs.map(d => this.mapService(d));
        this.changeDetector.detectChanges();
      });

      this.subscribeToUsers();
    } catch (error) {
      console.error('Could not fetch users from Firestore:', error);
      await this.showToast('Could not load services. Check Firestore rules.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  get filteredServices() {
    const search = this.searchTerm.trim().toLowerCase();

    return this.services.filter(service => {
      const matchesSearch = !search || [
        service.serviceName,
        service.price,
        service.category,
        service.duration,
        service.status
      ].some(value => String(value).toLowerCase().includes(search));
      const matchesStatus = this.statusFilter === 'all'
        || service.status.trim().toLowerCase() === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  subscribeToUsers() {

    this.stopUsersListener = onSnapshot(
      laundryServicesCol,
      snapshot => {
        this.zone.run(() => {
          this.services = snapshot.docs.map(d => this.mapService(d));
          this.changeDetector.detectChanges();
        });
      },
      error => {
        console.error('Could not load users from Firestore:', error);
        this.showToast('Could not load services. Check Firestore rules.', 'danger');
      }
    );

  }

  async deleteService(service: { id: string; serviceName: string }) {
    const confirmation = await this.alertCtrl.create({
      header: 'Delete service?',
      message: `Delete ${service.serviceName}?`,
      buttons: [
        'Cancel',
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await deleteDoc(doc(laundryServicesCol, service.id));
              this.zone.run(() => {
                this.services = this.services.filter(item => item.id !== service.id);
                this.changeDetector.detectChanges();
              });
              await this.showToast('Service deleted.', 'success');
            } catch (error) {
              console.error('Could not delete laundry service:', error);
              await this.showToast('Could not delete service.', 'danger');
            }
          }
        }
      ]
    });

    await confirmation.present();
  }

  openEditModal(service: LaundryService) {
    this.editingService = { ...service };
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
  }

  async saveService() {
    const service = {
      serviceName: String(this.editingService.serviceName).trim(),
      price: String(this.editingService.price).trim(),
      category: String(this.editingService.category).trim(),
      duration: String(this.editingService.duration).trim(),
      status: String(this.editingService.status).trim()
    };

    if (!service.serviceName || !service.price || !service.category || !service.duration || !service.status) {
      await this.showToast('Please fill in every field.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Saving changes...'
    });
    await loading.present();

    try {
      await updateDoc(doc(laundryServicesCol, this.editingService.id), service);
      this.closeEditModal();
      await this.showToast('Service updated.', 'success');
    } catch (error) {
      console.error('Could not update laundry service:', error);
      await this.showToast('Could not update service.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2200,
      position: 'bottom'
    });
    await toast.present();
  }

}