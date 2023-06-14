import * as L from 'leaflet';
import { Cluster } from './cluster';
export class ClusterMarker extends L.MarkerCluster
{
  public data? : Cluster | undefined;
  constructor(latLng : L.LatLngExpression, options? : L.MarkerOptions)
  {
    super(latLng, options);
  }

  public setData(_data : Cluster)
  {
    if (this.data === undefined)
    {
        return;
    }
    this.data = _data;
  }

  public getData() : Cluster | undefined
  {
    if (this.data === undefined)
    {
        return undefined;
    }
    return this.data;
  }
}