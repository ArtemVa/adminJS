import axios from 'axios';
import Chat from '../db/chat.model.js';
import Project from '../db/project.model.js';

export async function handleLeadBitrix(projectId, phone, interlocutor, currentStatus, chatId, dbData) {
  try {
    let project = await Project.findById(projectId);
    let chat = await Chat.findById(chatId);
    const url = `${process.env.BITRIX_URI}/bitrix/lead`;
    let statusId;
    switch (currentStatus) {
      case 'completed':
        statusId = project.settings.funnels.items.completed; // 142
        break;
      case 'closed':
        statusId = project.settings.funnels.items.closed; // 143
        break;
      case 'interest_shown':
        statusId = project.settings.funnels.items.interestShown; // 72233506
        break;
      case 'contact_received':
        statusId = project.settings.funnels.items.contactReceived; // 72233510
        break;
      default:
        throw new Error('Unknown status');
    }
    if (statusId == chat.leadId)
      return;
    if (statusId == project.settings.funnels.items.completed || statusId == project.settings.funnels.items.closed)
      chat.leadId = ''
    const response = await axios.get(url, {
      params: {
        user_id: project.userId,
        user_name: interlocutor.username, // Имя пользователя (опционально)
        phone: interlocutor.phone, // Номер телефона (опционально)
        remote_lead_id: chat.leadId,
        remote_step_id: statusId,
      },
    });
    console.log("BITRIX", response.data)
    if (response.data.lead_id)
      await Chat.updateOne({ _id: chat._id }, { leadId: response.data.lead_id })
    return response.data;
    // Проверяем статус ответа
    if (response.status === 200) {
      console.log('send')
      return response.data; // Успешный ответ
    } else {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  } catch (error) {
    console.error(error)
    // Обработка ошибок
    if (error.response) {
      // Сервер вернул ошибку (например, 401 или 500)
      return error.response.data;
    } else if (error.request) {
      // Запрос был отправлен, но ответ не получен
      return { error: 'No response received from the server' };
    } else {
      // Ошибка при настройке запроса
      return { error: error.message };
    }
  }
}

export async function handleInternalLeadBitrix(phone, username, email) {
  try {
    const url = `${process.env.BITRIX_URI}/bitrix/lead`;
    const response = await axios.get(url, {
      params: {
        user_name: username,
        phone: phone,
        internal: true,
        email: email
      },
    });
    console.log("BITRIX internal", response.data)

    return response.data;
  } catch (error) {
    console.error(error)
    if (error.response) {
      return error.response.data;
    } else if (error.request) {
      return { error: 'No response received from the server' };
    } else {
      return { error: error.message };
    }
  }
}

export async function getBitrixPipelines(userId) {
  try {
    const url = `${process.env.BITRIX_URI}/bitrix/pipelines`;

    const response = await axios.get(url, {
      params: {
        user_id: userId,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching pipelines:', error.message);
    if (error.response) {
      console.error('Server responded with:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('No response received from server.');
    }
    throw error;
  }
}

export async function handleBitrixAuth(userId, code, domain, state) {
  try {
    console.log(3)
    const url = `${process.env.BITRIX_URI}/bitrix`;

    const response = await axios.get(`${url}?code=${code}&state=${state}&user_id=${userId}&domain=${domain}`);
    console.log(4)
    // Проверяем статус ответа
    if (response.status === 200) {
      console.log(response.data)
      return response.data; // Успешный ответ
    } else {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  } catch (error) {
    console.error(error)
    // Обработка ошибок
    if (error.response) {
      // Сервер вернул ошибку (например, 401 или 500)
      return error.response.data;
    } else if (error.request) {
      // Запрос был отправлен, но ответ не получен
      return { error: 'No response received from the server' };
    } else {
      // Ошибка при настройке запроса
      return { error: error.message };
    }
  }
}