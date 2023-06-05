import * as L from 'leaflet';
import { Patient } from './patient';
var classifyPoint = require('robust-point-in-polygon');
export class Cluster
{
  // static reference to the leaflet map
  static Map : L.Map | undefined;

  static LeafletMarkerClustersGroup : L.FeatureGroup = new L.FeatureGroup();

  static MappedPolygons : L.FeatureGroup = new L.FeatureGroup();

  // Leaflet polygon drawn on map
  private _polygon : L.Polygon | undefined;
  // shape of the cluster used to determine if point is inside of cluster
  private _shape : any[] | undefined;
  // patients within the cluster
  private _patients: Patient[] = [];
  // the clickable cluster icon for this cluster
  private _leafletMarkerCluster : L.MarkerCluster | undefined;

  private _hasBeenPartitioned : boolean = false;

  private _color : string = "#0d0d0d";

  constructor()
  {
    this._shape = [];
  }


  public IsPointWithinCluster(point : any[]) : boolean
  {
    let isInside = classifyPoint(this._shape,point);

    // if the point is inside or on the edge of a cluster boundary, then include it
    if (isInside == -1 || isInside == 0)
    {
      return true;
    }
    return false;
  }

  public Destroy()
  {
    Cluster.LeafletMarkerClustersGroup.removeLayer(this._leafletMarkerCluster as L.Layer);
    Cluster.MappedPolygons.removeLayer(this._polygon as L.Layer);
  }

    public get patients(): Patient[] {
        return this._patients;
    }
    public set patients(value: Patient[]) {
        this._patients = value;
    }

  public set hasBeenPartitioned(theHasBeenPartitioned : boolean)
  {
    this._hasBeenPartitioned = theHasBeenPartitioned;
  }

  public get hasBeenPartitioned() : boolean
  {
    return this._hasBeenPartitioned;
  }

  public set leafletMarkerCluster(theMarkerCluster : L.MarkerCluster)
  {
    try
    {
      Cluster.LeafletMarkerClustersGroup.removeLayer(this._leafletMarkerCluster as L.Layer);
    }
    catch
    {

    }
    this._leafletMarkerCluster = theMarkerCluster;
    this._leafletMarkerCluster.addTo(Cluster.LeafletMarkerClustersGroup);
  }

  public get leafletMarkerCluster() : L.MarkerCluster
  {
    return this._leafletMarkerCluster!;
  }

  public set polygon(thePolygon : L.Polygon)
  {
    try
    {
      Cluster.MappedPolygons.removeLayer(this._polygon as L.Layer);
    }
    catch
    {

    }
    this._polygon = thePolygon;
    this._polygon.addTo(Cluster.MappedPolygons);
  }

  public get polygon() : L.Polygon
  {
    return this._polygon!;
  }

  public set shape(theShape : any[])
  {
    this._shape = theShape;
  }

  public get shape() : any[]
  {
    return this._shape!;
  }

  public set color(theColor : string)
  {
    this._color = theColor;
  }

  public get color() : string
  {
    return this._color!;
  }

}