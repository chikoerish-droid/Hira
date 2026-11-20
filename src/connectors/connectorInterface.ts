import type { ActionOutcomeStatus, Connection, Order, Product, ReturnRequest, Shipment } from '../types/domain';

export interface ConnectorOperationResult<T = unknown> {
  status: ActionOutcomeStatus;
  isSimulated: boolean;
  message: string;
  data?: T;
  connectorId: string;
  duplicateBlocked?: boolean;
}

/**
 * Platform-neutral StoreConnector boundary.
 * Future official integrations (Shopify, WooCommerce, BigCommerce, Marketplaces,
 * Custom API, or User-Authorized Browser Connector) implement this exact interface.
 */
export interface StoreConnector {
  readonly connection: Connection;
  getHealthStatus(): {
    connected: boolean;
    mode: 'demo_sandbox' | 'live_api' | 'browser_authorized';
    summary: string;
  };
  listProducts(products: Product[]): Promise<ConnectorOperationResult<Product[]>>;
  listOrders(orders: Order[]): Promise<ConnectorOperationResult<Order[]>>;
  saveProductDraft(product: Product): Promise<ConnectorOperationResult<Product>>;
  publishProduct(product: Product, duplicateKey: string): Promise<ConnectorOperationResult<Product>>;
  prepareShipment(shipment: Shipment, duplicateKey: string): Promise<ConnectorOperationResult<Shipment>>;
  sendCustomerMessage(
    conversationId: string,
    messageText: string,
    duplicateKey: string
  ): Promise<ConnectorOperationResult<{ sentAt: string }>>;
  processReturnDecision(
    returnRequest: ReturnRequest,
    decision: 'approved' | 'declined',
    duplicateKey: string
  ): Promise<ConnectorOperationResult<ReturnRequest>>;
  issueRefund(returnId: string, amount: number): Promise<ConnectorOperationResult<null>>;
}
