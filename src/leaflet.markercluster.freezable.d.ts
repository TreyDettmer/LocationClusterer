import * as L from 'leaflet';

declare module 'leaflet' {
  class MarkerClusterGroup{
    freezeAtZoom(frozenZoom?: number | boolean | 'max' | 'maxKeepSpiderfy'): this;

    unfreeze(): this;

    disableClustering(): this;

    disableClusteringKeepSpiderfy(): this;

    enableClustering(): this;

  }
}