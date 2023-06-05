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

@NgModule({
  declarations: [
    AppComponent,
    LoadingSpinnerComponent,
    MapComponent,
    ClusterSwitcherDialogComponent
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
    LeafletMarkerClusterModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
