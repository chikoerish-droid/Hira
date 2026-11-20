import type { Order, Product, ReturnRequest, Shipment } from '../types/domain';
import type { ConnectorOperationResult, StoreConnector } from './connectorInterface';
import { CONNECTOR_CATALOG } from './platformCatalog';

const executedDuplicateKeys = new Set<string>();

export function resetDemoConnectorGuards(): void {
  executedDuplicateKeys.clear();
}

export class DemoStoreConnector implements StoreConnector {
  readonly connection = CONNECTOR_CATALOG[0];

  getHealthStatus() {
    return {
      connected: false,
      mode: 'demo_sandbox' as const,
      summary: 'DEMO STORE — NOT CONNECTED. Running against persistent browser demo storage.',
    };
  }

  async listProducts(products: Product[]): Promise<ConnectorOperationResult<Product[]>> {
    return {
      status: 'completed',
      isSimulated: true,
      message: `Loaded ${products.length} products from demo store catalog.`,
      data: products,
      connectorId: this.connection.id,
    };
  }

  async listOrders(orders: Order[]): Promise<ConnectorOperationResult<Order[]>> {
    return {
      status: 'completed',
      isSimulated: true,
      message: `Loaded ${orders.length} demo orders.`,
      data: orders,
      connectorId: this.connection.id,
    };
  }

  async saveProductDraft(product: Product): Promise<ConnectorOperationResult<Product>> {
    return {
      status: 'simulated',
      isSimulated: true,
      message: `Saved draft listing "${product.title}" in demo store.`,
      data: { ...product, status: 'draft' },
      connectorId: this.connection.id,
    };
  }

  async publishProduct(product: Product, duplicateKey: string): Promise<ConnectorOperationResult<Product>> {
    if (executedDuplicateKeys.has(duplicateKey)) {
      return {
        status: 'blocked',
        isSimulated: true,
        duplicateBlocked: true,
        message: 'Duplicate-action guard prevented re-publishing the same listing twice.',
        connectorId: this.connection.id,
      };
    }
    executedDuplicateKeys.add(duplicateKey);
    return {
      status: 'simulated',
      isSimulated: true,
      message: `SIMULATED: Marked "${product.title}" as published in demo catalog (not published to a real storefront).`,
      data: { ...product, status: 'published' },
      connectorId: this.connection.id,
    };
  }

  async prepareShipment(shipment: Shipment, duplicateKey: string): Promise<ConnectorOperationResult<Shipment>> {
    if (executedDuplicateKeys.has(duplicateKey)) {
      return {
        status: 'blocked',
        isSimulated: true,
        duplicateBlocked: true,
        message: 'Duplicate-action guard prevented preparing an identical shipment twice.',
        connectorId: this.connection.id,
      };
    }
    executedDuplicateKeys.add(duplicateKey);
    return {
      status: 'simulated',
      isSimulated: true,
      message: `SIMULATED: Prepared demo shipment ${shipment.trackingNumber} via ${shipment.carrier} (${shipment.service}). No real carrier label was purchased.`,
      data: shipment,
      connectorId: this.connection.id,
    };
  }

  async sendCustomerMessage(
    conversationId: string,
    _messageText: string,
    duplicateKey: string
  ): Promise<ConnectorOperationResult<{ sentAt: string }>> {
    if (executedDuplicateKeys.has(duplicateKey)) {
      return {
        status: 'blocked',
        isSimulated: true,
        duplicateBlocked: true,
        message: 'Duplicate-action guard prevented sending the same customer message twice.',
        connectorId: this.connection.id,
      };
    }
    executedDuplicateKeys.add(duplicateKey);
    return {
      status: 'simulated',
      isSimulated: true,
      message: `SIMULATED: Recorded outbound reply in demo conversation ${conversationId}. No real email or chat message was transmitted.`,
      data: { sentAt: new Date().toISOString() },
      connectorId: this.connection.id,
    };
  }

  async processReturnDecision(
    returnRequest: ReturnRequest,
    decision: 'approved' | 'declined',
    duplicateKey: string
  ): Promise<ConnectorOperationResult<ReturnRequest>> {
    if (executedDuplicateKeys.has(duplicateKey)) {
      return {
        status: 'blocked',
        isSimulated: true,
        duplicateBlocked: true,
        message: 'Duplicate-action guard prevented repeating the same return decision.',
        connectorId: this.connection.id,
      };
    }
    executedDuplicateKeys.add(duplicateKey);
    return {
      status: 'simulated',
      isSimulated: true,
      message: `SIMULATED: Return ${returnRequest.returnNumber} marked ${decision} in demo store. No payment refund was issued.`,
      data: returnRequest,
      connectorId: this.connection.id,
    };
  }

  async issueRefund(_returnId: string, _amount: number): Promise<ConnectorOperationResult<null>> {
    return {
      status: 'blocked',
      isSimulated: true,
      message:
        'BLOCKED: Real payment refunds are disabled in Demo Store mode and require a live payment/platform connector with explicit refund authorization.',
      connectorId: this.connection.id,
    };
  }
}

export const demoConnector = new DemoStoreConnector();
