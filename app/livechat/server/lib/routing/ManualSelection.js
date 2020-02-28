import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';

import { Livechat } from '../Livechat';
import { RoutingManager } from '../RoutingManager';
import { sendNotification } from '../../../../lib/server';
import { LivechatRooms, LivechatInquiry } from '../../../../models/server';

/* Manual Selection Queuing Method:
	*
	* An incomming livechat is created as an Inquiry
	* which is picked up from an agent.
	* An Inquiry is visible to all agents
	*
	* A room is still created with the initial message, but it is occupied by
	* only the client until paired with an agent
*/
class ManualSelection {
	constructor() {
		this.config = {
			previewRoom: true,
			showConnecting: true,
			showQueue: true,
			showQueueLink: true,
			returnQueue: true,
			enableTriggerAction: false,
			autoAssignAgent: false,
		};
	}

	getNextAgent() {

	}

	delegateAgent(agent, inquiry) {
		const { department, rid, v } = inquiry;
		const allAgents = Livechat.getAgents(department);

		if (allAgents.count() === 0) {
			throw new Meteor.Error('no-agent-available', 'Sorry, no available agents.');
		}

		// remove agent from room in case the rooms is being transferred or returned to the Queue
		LivechatRooms.removeAgentByRoomId(rid);
		LivechatInquiry.queueInquiry(inquiry._id);

		// Alert only the online agents of the queued request
		const onlineAgents = Livechat.getOnlineAgents(department);
		const { message } = inquiry;

		const room = LivechatRooms.findOneById(rid);

		onlineAgents.forEach((agent) => {
			const { _id, active, emails, language, status, statusConnection, username } = agent;
			sendNotification({
				// fake a subscription in order to make use of the function defined above
				subscription: {
					rid,
					t: 'l',
					u: {
						_id,
					},
					receiver: [{
						active,
						emails,
						language,
						status,
						statusConnection,
						username,
					}],
				},
				sender: v,
				hasMentionToAll: true, // consider all agents to be in the room
				hasMentionToHere: false,
				message: Object.assign({}, { u: v }),
				notificationMessage: message.msg,
				room: Object.assign(room, { name: TAPi18n.__('New_livechat_in_queue') }),
				mentionIds: [],
			});
		});

		return agent;
	}
}

RoutingManager.registerMethod('Manual_Selection', ManualSelection);
