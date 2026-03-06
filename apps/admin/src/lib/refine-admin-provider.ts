"use client";

import axios from "axios";
import dataProvider from "@refinedev/simple-rest";
import { getStoredSession } from "@/lib/admin-auth";

const API_URL = "";
const STRAPI_REST_API = `${API_URL}/api`;

export function createAdminDataProvider() {
  const httpClient = axios.create();

  httpClient.interceptors.request.use((config) => {
    const session = getStoredSession();
    if (session?.jwt) {
      config.headers.Authorization = `Bearer ${session.jwt}`;
    }
    return config;
  });

  return dataProvider(STRAPI_REST_API, httpClient);
}
