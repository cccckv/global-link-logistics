import { FastifyInstance } from 'fastify';
import { CustomerV2Service, CustomerAddressInput } from './customer.service';
import { authorize } from '../../../lib/auth';

const customerService = new CustomerV2Service();
const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];

export async function customerV2Routes(fastify: FastifyInstance) {
  // Search or list all customers
  fastify.get<{
    Querystring: { search?: string; code?: string };
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { search, code } = request.query;
    if (code) {
      const customer = await customerService.getCustomerByCode(code);
      return reply.send({ success: true, data: customer });
    }
    const customers = await customerService.searchCustomers(search);
    return reply.send({ success: true, data: customers });
  });

  // Get single customer details
  fastify.get<{
    Params: { id: string };
  }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const customer = await customerService.getCustomerById(request.params.id);
    if (!customer) {
      return reply.code(404).send({ success: false, error: 'Customer not found' });
    }
    return reply.send({ success: true, data: customer });
  });

  const internalHandler = { preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)] };

  // Create new customer (Internal only)
  fastify.post<{
    Body: {
      clientCode: string;
      name: string;
      phone?: string;
      company?: string;
      destinationCountry?: string;
      destinationPort?: string;
      defaultWarehouse?: string;
      note?: string;
      addresses?: Array<CustomerAddressInput>;
    };
  }>('/', internalHandler, async (request, reply) => {
    try {
      const created = await customerService.createCustomer(request.body);
      return reply.code(201).send({ success: true, data: created });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ success: false, error: '客户编码/唛头已存在，请使用唯一编码' });
      }
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Update customer basic info (Internal only)
  fastify.put<{
    Params: { id: string };
    Body: Partial<{
      clientCode: string;
      name: string;
      phone?: string;
      company?: string;
      destinationCountry?: string;
      destinationPort?: string;
      defaultWarehouse?: string;
      note?: string;
    }>;
  }>('/:id', internalHandler, async (request, reply) => {
    try {
      const updated = await customerService.updateCustomer(request.params.id, request.body);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Add address to customer (Internal only)
  fastify.post<{
    Params: { id: string };
    Body: CustomerAddressInput;
  }>('/:id/addresses', internalHandler, async (request, reply) => {
    try {
      const address = await customerService.addCustomerAddress(request.params.id, request.body);
      return reply.code(201).send({ success: true, data: address });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Update address (Internal only)
  fastify.put<{
    Params: { id: string; addressId: string };
    Body: Partial<CustomerAddressInput>;
  }>('/:id/addresses/:addressId', internalHandler, async (request, reply) => {
    try {
      const updated = await customerService.updateCustomerAddress(request.params.addressId, {
        ...request.body,
        customerId: request.params.id,
      });
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete address (Internal only)
  fastify.delete<{
    Params: { id: string; addressId: string };
  }>('/:id/addresses/:addressId', internalHandler, async (request, reply) => {
    try {
      await customerService.deleteCustomerAddress(request.params.addressId);
      return reply.send({ success: true, message: 'Address deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Set address as default (Internal only)
  fastify.put<{
    Params: { id: string; addressId: string };
  }>('/:id/addresses/:addressId/default', internalHandler, async (request, reply) => {
    try {
      const updated = await customerService.setDefaultCustomerAddress(request.params.id, request.params.addressId);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete customer (Internal only)
  fastify.delete<{
    Params: { id: string };
  }>('/:id', internalHandler, async (request, reply) => {
    try {
      await customerService.deleteCustomer(request.params.id);
      return reply.send({ success: true, message: 'Customer deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
