import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button'
import {MatFormFieldModule} from '@angular/material/form-field';
import { AppComponent } from './app.component';
import {MatInputModule} from '@angular/material/input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatIconModule} from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { MapComponent } from './components/map/map.component';
import { MatTooltipModule } from '@angular/material/tooltip'; 
import {MatDialogModule} from '@angular/material/dialog';
import { ClusterSwitcherDialogComponent } from './components/cluster-switcher-dialog/cluster-switcher-dialog.component';
import { HttpClientModule } from '@angular/common/http';
import { LeafletMarkerClusterModule } from '@asymmetrik/ngx-leaflet-markercluster';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PatientPanelComponent } from './components/patient-panel/patient-panel.component';
import { ClusterPanelComponent } from './components/cluster-panel/cluster-panel.component';
import { RouterModule, Routes } from '@angular/router';
import { MainComponent } from './components/main/main.component';
import { LoginComponent } from './components/login/login.component'
import { isUserLoggedInGuard } from './interfaces/auth.guard';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AlertDialogComponent } from './components/alert-dialog/alert-dialog.component';

const routes: Routes = [  
  { path: 'main', component: MainComponent,
    canActivate:[isUserLoggedInGuard] 
  },

  { path: 'login', component: LoginComponent},
  { path: '', redirectTo: '/main', pathMatch: 'full' },
  { path: '**', component:LoginComponent}
];

@NgModule({
  declarations: [
    AppComponent,
    LoadingSpinnerComponent,
    MapComponent,
    ClusterSwitcherDialogComponent,
    PatientPanelComponent,
    ClusterPanelComponent,
    MainComponent,
    LoginComponent,
    AlertDialogComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatTooltipModule,
    MatDialogModule,
    HttpClientModule,
    LeafletMarkerClusterModule,
    MatCheckboxModule,
    FontAwesomeModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
