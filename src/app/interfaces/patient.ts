import * as L from 'leaflet';
export class Patient
{

    static HighlightedStyle = `
            background-color: #ffd500;
            width: 1.25rem;
            height: 1.25rem;
            display: block;
            left: 0;
            top: 0;
            position: relative;
            border-radius: 1.25rem;
            border: 1px solid #000000;
            text-align: center;
            color: white;
            box-shadow: 2px 2px 3px grey;`;
    static HighlightedIcon = L.divIcon({
                className: "patient-icon"
              });

    static HoveredStyle = `
              background-color: #ff7300;
              width: 1.25rem;
              height: 1.25rem;
              display: block;
              left: 0;
              top: 0;
              position: relative;
              border-radius: 1.25rem;
              border: 1px solid #000000;
              text-align: center;
              color: white;
              box-shadow: 2px 2px 3px grey;`;
      static HoveredIcon = L.divIcon({
                  className: "patient-icon",
                });

    static DefaultStyle = `
              background-color: #000000;
              width: 30px;
              height: 30px;
              display: block;
              left: 0;
              top: 0;
              position: relative;
              border-radius: 50%;
              border: 1px solid #FFFFFF;
              text-align: center;
              color: white;
              box-shadow: 2px 2px 3px grey;`;
      static DefaultIcon = L.divIcon({
                  className: "patient-icon"
                });
    private _latitude : number = 0.0;
    private _longitude : number = 0.0;
    private _patUID: string = "";
    private _zip: string = "";
    private _location : [number,number] = [0.0,0.0];
    private _memberAddress : string = "";
    private _city: string = "";
    private _state: string = "";
    private _county: string = "";
    private _marker!: PatientMarker;
    private _squaredDistanceFromOrigin: number = -1;


    public get squaredDistanceFromOrigin(): number {
        return this._squaredDistanceFromOrigin;
    }
    public set squaredDistanceFromOrigin(value: number) {
        this._squaredDistanceFromOrigin = value;
    }


    public get marker(): PatientMarker {
        return this._marker;
    }
    public set marker(value: PatientMarker) {
        this._marker = value;
    }

    public get county(): string {
        return this._county;
    }
    public set county(value: string) {
        this._county = value;
    }

    public get patUID(): string {
        return this._patUID;
    }
    public set patUID(value: string) {
        this._patUID = value;
    }

    public get zip(): string {
        return this._zip;
    }
    public set zip(value: string) {
        this._zip = value;
    }

    public get state(): string {
        return this._state;
    }
    public set state(value: string) {
        this._state = value;
    }

    public get city(): string {
        return this._city;
    }
    public set city(value: string) {
        this._city = value;
    }

    public set memberAddress(theMemberAddress : string)
    {
        this._memberAddress = theMemberAddress;
    }
  
    public get memberAddress() : string
    {
      return this._memberAddress;
    }

    public set longitude(theLongitude : number)
    {
        this._longitude = theLongitude;
        this.location = [this._latitude,this._longitude];
    }
  
    public get longitude() : number
    {
      return this._longitude;
    }

    public set latitude(theLatitude : number)
    {
        this._latitude = theLatitude;
        this.location = [this._latitude,this._longitude];
    }
  
    public get latitude() : number
    {
      return this._latitude;
    }

    public set location(theLocation : [number,number])
    {
        this._location = theLocation;
        this._latitude = this._location[0];
        this._longitude = this._location[1];
    }
  
    public get location() : [number,number]
    {
      return this._location;
    }
}

export class PatientMarker extends L.Marker
{
    patient! : Patient;
    constructor(latLng: L.LatLngExpression, patient: Patient, options?: L.MarkerOptions) {
        super(latLng, options);
        this.setData(patient);
    }
    
    getData() {
        return this.patient;
    }

    setData(data: any) {
        this.patient = data;
    }
}