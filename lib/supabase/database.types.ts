export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alertas: {
        Row: {
          creada_en: string
          estacion_id: string | null
          estado: Database["public"]["Enums"]["estado_alerta"]
          id: string
          limite: number | null
          linea_id: string
          resuelta_en: string | null
          resuelta_por: string | null
          severidad: Database["public"]["Enums"]["severidad"]
          titulo: string
          unidad: string | null
          valor: number | null
        }
        Insert: {
          creada_en?: string
          estacion_id?: string | null
          estado?: Database["public"]["Enums"]["estado_alerta"]
          id?: string
          limite?: number | null
          linea_id: string
          resuelta_en?: string | null
          resuelta_por?: string | null
          severidad: Database["public"]["Enums"]["severidad"]
          titulo: string
          unidad?: string | null
          valor?: number | null
        }
        Update: {
          creada_en?: string
          estacion_id?: string | null
          estado?: Database["public"]["Enums"]["estado_alerta"]
          id?: string
          limite?: number | null
          linea_id?: string
          resuelta_en?: string | null
          resuelta_por?: string | null
          severidad?: Database["public"]["Enums"]["severidad"]
          titulo?: string
          unidad?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_estacion_id_fkey"
            columns: ["estacion_id"]
            isOneToOne: false
            referencedRelation: "estaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_resuelta_por_fkey"
            columns: ["resuelta_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      estaciones: {
        Row: {
          creada_en: string
          id: string
          linea_id: string
          nombre: string
          numero: number
        }
        Insert: {
          creada_en?: string
          id?: string
          linea_id: string
          nombre: string
          numero: number
        }
        Update: {
          creada_en?: string
          id?: string
          linea_id?: string
          nombre?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "estaciones_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "lineas"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores: {
        Row: {
          actualizado_en: string
          clave: string
          detalle: string
          estado: Database["public"]["Enums"]["severidad"]
          id: string
          linea_id: string
          mayor_es_mejor: boolean
          nombre: string
          orden: number
          umbral_atencion: number
          umbral_parar: number
          unidad: string
          valor: number
        }
        Insert: {
          actualizado_en?: string
          clave: string
          detalle: string
          estado?: Database["public"]["Enums"]["severidad"]
          id?: string
          linea_id: string
          mayor_es_mejor: boolean
          nombre: string
          orden?: number
          umbral_atencion: number
          umbral_parar: number
          unidad: string
          valor: number
        }
        Update: {
          actualizado_en?: string
          clave?: string
          detalle?: string
          estado?: Database["public"]["Enums"]["severidad"]
          id?: string
          linea_id?: string
          mayor_es_mejor?: boolean
          nombre?: string
          orden?: number
          umbral_atencion?: number
          umbral_parar?: number
          unidad?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "indicadores_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "lineas"
            referencedColumns: ["id"]
          },
        ]
      }
      intentos_login: {
        Row: {
          bloqueado_hasta: string | null
          bloqueos: number
          fallidos: number
          usuario_id: string
        }
        Insert: {
          bloqueado_hasta?: string | null
          bloqueos?: number
          fallidos?: number
          usuario_id: string
        }
        Update: {
          bloqueado_hasta?: string | null
          bloqueos?: number
          fallidos?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intentos_login_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas: {
        Row: {
          creada_en: string
          id: string
          nombre: string
          planta_id: string
          turno: string
        }
        Insert: {
          creada_en?: string
          id?: string
          nombre: string
          planta_id: string
          turno: string
        }
        Update: {
          creada_en?: string
          id?: string
          nombre?: string
          planta_id?: string
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantas: {
        Row: {
          creada_en: string
          id: string
          nombre: string
        }
        Insert: {
          creada_en?: string
          id?: string
          nombre: string
        }
        Update: {
          creada_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      plantillas_alerta: {
        Row: {
          estacion_numero: number
          id: string
          indicador_clave: string | null
          limite: number
          peso: number
          severidad: Database["public"]["Enums"]["severidad"]
          titulo: string
          unidad: string
          valor_max: number
          valor_min: number
        }
        Insert: {
          estacion_numero: number
          id?: string
          indicador_clave?: string | null
          limite: number
          peso: number
          severidad: Database["public"]["Enums"]["severidad"]
          titulo: string
          unidad: string
          valor_max: number
          valor_min: number
        }
        Update: {
          estacion_numero?: number
          id?: string
          indicador_clave?: string | null
          limite?: number
          peso?: number
          severidad?: Database["public"]["Enums"]["severidad"]
          titulo?: string
          unidad?: string
          valor_max?: number
          valor_min?: number
        }
        Relationships: []
      }
      sesiones: {
        Row: {
          fin: string | null
          id: string
          inicio: string
          usuario_id: string
        }
        Insert: {
          fin?: string | null
          id?: string
          inicio?: string
          usuario_id: string
        }
        Update: {
          fin?: string | null
          id?: string
          inicio?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          color: string
          creado_en: string
          id: string
          iniciales: string
          linea_id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          color: string
          creado_en?: string
          id?: string
          iniciales: string
          linea_id: string
          nombre: string
        }
        Update: {
          activo?: boolean
          color?: string
          creado_en?: string
          id?: string
          iniciales?: string
          linea_id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "lineas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_pin: {
        Row: {
          pin_hash: string
          usuario_id: string
        }
        Insert: {
          pin_hash: string
          usuario_id: string
        }
        Update: {
          pin_hash?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_pin_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cerrar_sesion: { Args: { p_sesion_id: string }; Returns: undefined }
      demo_autoresolver: { Args: { p_antiguedad?: string }; Returns: number }
      demo_generar_alertas: {
        Args: { p_cantidad?: number; p_linea_id?: string }
        Returns: {
          creada_en: string
          estacion_id: string | null
          estado: Database["public"]["Enums"]["estado_alerta"]
          id: string
          limite: number | null
          linea_id: string
          resuelta_en: string | null
          resuelta_por: string | null
          severidad: Database["public"]["Enums"]["severidad"]
          titulo: string
          unidad: string | null
          valor: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "alertas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      demo_simular_turno: {
        Args: { p_cantidad?: number; p_sesion_id: string }
        Returns: {
          creada_en: string
          estacion_id: string | null
          estado: Database["public"]["Enums"]["estado_alerta"]
          id: string
          limite: number | null
          linea_id: string
          resuelta_en: string | null
          resuelta_por: string | null
          severidad: Database["public"]["Enums"]["severidad"]
          titulo: string
          unidad: string | null
          valor: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "alertas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      desbloquear_usuario: {
        Args: { p_usuario_id: string }
        Returns: undefined
      }
      iniciar_sesion: {
        Args: { p_pin: string; p_usuario_id: string }
        Returns: string
      }
      resolver_alerta: {
        Args: {
          p_alerta_id: string
          p_resolucion: Database["public"]["Enums"]["estado_alerta"]
          p_sesion_id: string
        }
        Returns: undefined
      }
      tablero: { Args: { p_sesion_id: string }; Returns: Json }
      usuarios_login: {
        Args: never
        Returns: {
          color: string
          id: string
          iniciales: string
          nombre: string
        }[]
      }
    }
    Enums: {
      estado_alerta: "nueva" | "atendida" | "no_aplica"
      severidad: "parar" | "atencion" | "ok"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_alerta: ["nueva", "atendida", "no_aplica"],
      severidad: ["parar", "atencion", "ok"],
    },
  },
} as const

