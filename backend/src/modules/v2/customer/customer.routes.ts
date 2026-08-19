import { FastifyInstance } from 'fastify';
import { CustomerV2Service } from './customer.service';

const customerService = new CustomerV2Service();

export async function customerV2Routes(fastify: FastifyInstance) {
  // Search or list all customers
  fastify.get<{
    Querystring: { search?: string; code?: string };
  }>('/', async (request, reply) => {
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
  }>('/:id', async (request, reply) => {
    const customer = await customerService.getCustomerById(request.params.id);
    if (!customer) {
      return reply.code(404).send({ success: false, error: 'Customer not found' });
    }
    return reply.send({ success: true, data: customer });
  });

  // Create new customer
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
      addresses?: Array<{
        name: string;
        phone: string;
        company?: string;
        country?: string;
        region?: string;
        address: string;
        isDefault?: boolean;
      }>;
    };
  }>('/', async (request, reply) => {
    try {
      const created = await customerService.createCustomer(request.body);
      return reply.code(201).send({ success: true, data: created });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ success: false, error: '客户编码已存在' });
      }
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Add address to customer
  fastify.post<{
    Params: { id: string };
    Body: {
      name: string;
      phone: string;
      company?: string;
      country?: string;
      region?: string;
      address: string;
      isDefault?: boolean;
    };
  }>('/:id/addresses', async (request, reply) => {
    try {
      const created = await customerService.addCustomerAddress(request.params.id, request.body);
      return reply.code(201).send({ success: true, data: created });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete customer
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    try {
      await customerService.deleteCustomer(request.params.id);
      return reply.send({ success: true, message: '客户档案已删除' });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message || '删除客户失败' });
    }
  });
}
