import axios from 'axios';

const SHIPXY_BASE_URL = process.env.SHIPXY_BASE_URL || 'https://api.shipxy.com/apicall/v3';
const SHIPXY_API_KEY = process.env.SHIPXY_API_KEY;

export interface VesselSearchResult {
  matchType: number;
  mmsi: number;
  imo: number;
  callSign: string;
  shipName: string;
  dataSource: number;
  lastTime: string;
  lastTimeUtc: number;
}

export interface VesselPosition {
  mmsi: number;
  imo: number;
  callSign: string;
  shipName: string;
  shipCnName: string;
  shipType: number;
  length: number;
  width: number;
  draught: number;
  destination: string;
  destinationCode: string;
  eta: string;
  lat: number;
  lng: number;
  sog: number;
  cog: number;
  heading: number;
  rot: number;
  lastTime: string;
  lastTimeUtc: number;
}

export interface ShipxySearchApiResponse {
  status: number;
  msg: string;
  total: number;
  data: Array<{
    match_type: number;
    mmsi: number;
    imo: number;
    call_sign: string;
    ship_name: string;
    data_source: number;
    last_time: string;
    last_time_utc: number;
  }>;
}

export interface ShipxyDetailApiResponse {
  status: number;
  msg: string;
  data: {
    mmsi: number;
    imo: number;
    call_sign: string;
    ship_name: string;
    ship_cnname: string;
    data_source: number;
    ship_type: number;
    length: number;
    width: number;
    left: number;
    trail: number;
    draught: number;
    dest: string;
    destcode: string;
    eta: string;
    navistat: number;
    lat: number;
    lng: number;
    sog: number;
    cog: number;
    hdg: number;
    rot: number;
    last_time: string;
    last_time_utc: number;
  };
}

export class VesselService {
  async searchVessels(keywords: string, max: number = 10): Promise<VesselSearchResult[]> {
    if (!SHIPXY_API_KEY) {
      throw new Error('SHIPXY_API_KEY is not configured');
    }

    const maxResults = Math.min(Math.max(max, 1), 100);

    try {
      const response = await axios.get<ShipxySearchApiResponse>(
        `${SHIPXY_BASE_URL}/SearchShip`,
        {
          params: {
            key: SHIPXY_API_KEY,
            keywords,
            max: maxResults,
          },
          timeout: 10000,
        }
      );

      if (response.data.status !== 0) {
        throw new Error(response.data.msg || 'Failed to search vessels');
      }

      return response.data.data.map(item => ({
        matchType: item.match_type,
        mmsi: item.mmsi,
        imo: item.imo,
        callSign: item.call_sign,
        shipName: item.ship_name,
        dataSource: item.data_source,
        lastTime: item.last_time,
        lastTimeUtc: item.last_time_utc,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout');
        }
        if (error.response?.status === 404) {
          throw new Error('Vessel not found');
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(error.response?.data?.msg || 'Failed to search vessels');
      }
      throw error;
    }
  }

  async getVesselPositionByMmsi(mmsi: string): Promise<VesselPosition> {
    if (!SHIPXY_API_KEY) {
      throw new Error('SHIPXY_API_KEY is not configured');
    }

    try {
      const response = await axios.get<ShipxyDetailApiResponse>(
        `${SHIPXY_BASE_URL}/GetSingleShip`,
        {
          params: {
            key: SHIPXY_API_KEY,
            mmsi,
          },
          timeout: 10000,
        }
      );

      if (response.data.status !== 0) {
        throw new Error(response.data.msg || 'Failed to fetch vessel position');
      }

      const data = response.data.data;
      
      return {
        mmsi: data.mmsi,
        imo: data.imo,
        callSign: data.call_sign,
        shipName: data.ship_name,
        shipCnName: data.ship_cnname,
        shipType: data.ship_type,
        length: data.length,
        width: data.width,
        draught: data.draught,
        destination: data.dest,
        destinationCode: data.destcode,
        eta: data.eta,
        lat: data.lat,
        lng: data.lng,
        sog: data.sog,
        cog: data.cog,
        heading: data.hdg,
        rot: data.rot,
        lastTime: data.last_time,
        lastTimeUtc: data.last_time_utc,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout');
        }
        if (error.response?.status === 404) {
          throw new Error('Vessel not found');
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(error.response?.data?.msg || 'Failed to fetch vessel position');
      }
      throw error;
    }
  }
}

export const vesselService = new VesselService();
